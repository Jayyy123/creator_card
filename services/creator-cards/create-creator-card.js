const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCardMessages = require('@app/messages/creator-card');
const CreatorCard = require('@app/repository/creator-card');

const spec = `root {
  title string<trim|minLength:3|maxLength:100>
  description? string<trim|maxLength:500>
  slug? string<trim|minLength:5|maxLength:50>
  creator_reference string<length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string<uppercase>
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<length:6>
}`;

const parsedSpec = validator.parse(spec);

function generateRandomSuffix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function isAlphanumeric(str) {
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const isLetter = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    const isDigit = c >= '0' && c <= '9';
    if (!isLetter && !isDigit) {
      return false;
    }
  }
  return true;
}

function isValidSlugChar(c) {
  const isLetter = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  const isDigit = c >= '0' && c <= '9';
  return isLetter || isDigit || c === '-' || c === '_';
}

function generateSlugFromTitle(title) {
  const lowered = title.toLowerCase();
  let slug = '';
  for (let i = 0; i < lowered.length; i++) {
    const c = lowered[i];
    if (c === ' ' || c === '\t') {
      // collapse consecutive hyphens
      if (slug.length > 0 && slug[slug.length - 1] !== '-') {
        slug += '-';
      }
    } else if (isValidSlugChar(c)) {
      slug += c;
    }
  }
  // strip leading/trailing hyphens
  while (slug.length > 0 && slug[0] === '-') {
    slug = slug.substring(1);
  }
  while (slug.length > 0 && slug[slug.length - 1] === '-') {
    slug = slug.substring(0, slug.length - 1);
  }
  return slug;
}

function serializeCard(card) {
  const serialized = {
    id: card._id,
    title: card.title,
    description: card.description || null,
    slug: card.slug,
    creator_reference: card.creator_reference,
    links: card.links || [],
    service_rates: card.service_rates || null,
    status: card.status,
    access_type: card.access_type,
    access_code: card.access_code || null,
    created: card.created,
    updated: card.updated,
    deleted: card.deleted === 0 ? null : card.deleted,
  };
  return serialized;
}

async function createCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedSpec);
  let response;

  try {
    // default access_type to public
    if (!data.access_type) {
      data.access_type = 'public';
    }

    // access_code business rules
    if (data.access_type === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_REQUIRED, 'AC01');
    }

    if (data.access_type === 'public' && data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_NOT_ALLOWED, 'AC05');
    }

    // validate access_code is alphanumeric if provided
    if (data.access_code && !isAlphanumeric(data.access_code)) {
      throwAppError('access_code must be alphanumeric', 'AC01');
    }

    // validate currency enum if service_rates is present
    if (data.service_rates) {
      const validCurrencies = ['NGN', 'USD', 'GBP', 'GHS'];
      if (validCurrencies.indexOf(data.service_rates.currency) === -1) {
        throwAppError(
          'currency must be one of NGN, USD, GBP, GHS',
          ERROR_CODE.INVLDDATA
        );
      }

      // rates array must not be empty
      if (!data.service_rates.rates || !data.service_rates.rates.length) {
        throwAppError(
          'rates must be a non-empty array',
          ERROR_CODE.INVLDDATA
        );
      }

      // validate each rate amount is a positive integer
      for (let i = 0; i < data.service_rates.rates.length; i++) {
        const rate = data.service_rates.rates[i];
        if (!Number.isInteger(rate.amount) || rate.amount < 1) {
          throwAppError(
            'amount must be a positive integer',
            ERROR_CODE.INVLDDATA
          );
        }
      }
    }

    // validate link urls
    if (data.links && data.links.length) {
      const seenUrls = [];
      for (let i = 0; i < data.links.length; i++) {
        const link = data.links[i];
        if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
          throwAppError(
            'link url must start with http:// or https://',
            ERROR_CODE.INVLDDATA
          );
        }

        // prevent duplicate urls on the same card
        if (seenUrls.indexOf(link.url) !== -1) {
          throwAppError(
            'duplicate link URLs are not allowed',
            ERROR_CODE.INVLDDATA
          );
        }
        seenUrls.push(link.url);
      }
    }

    // slug handling
    let slug = data.slug;

    if (slug) {
      // validate slug characters
      for (let i = 0; i < slug.length; i++) {
        if (!isValidSlugChar(slug[i])) {
          throwAppError(
            'slug can only contain letters, numbers, hyphens and underscores',
            ERROR_CODE.INVLDDATA
          );
        }
      }
      slug = slug.toLowerCase();

      // check uniqueness for client-provided slug
      const existing = await CreatorCard.findOne({ query: { slug } });
      if (existing) {
        throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
      }
    } else {
      // auto-generate from title
      slug = generateSlugFromTitle(data.title);

      if (slug.length < 5) {
        slug = slug + '-' + generateRandomSuffix();
      } else {
        // check if taken
        const existing = await CreatorCard.findOne({ query: { slug } });
        if (existing) {
          slug = slug + '-' + generateRandomSuffix();
        }
      }
    }

    // build the card document
    const cardData = {
      title: data.title,
      description: data.description || null,
      slug,
      creator_reference: data.creator_reference,
      links: data.links || [],
      service_rates: data.service_rates || null,
      status: data.status,
      access_type: data.access_type,
      access_code: data.access_type === 'private' ? data.access_code : null,
    };

    const created = await CreatorCard.create(cardData);

    response = serializeCard(created);
  } catch (error) {
    appLogger.error({ error: error.message }, 'create-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = createCreatorCard;
module.exports.serializeCard = serializeCard;
