const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCardMessages = require('@app/messages/creator-card');
const CreatorCard = require('@app/repository/creator-card');

function serializeCardForRetrieval(card) {
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
    created: card.created,
    updated: card.updated,
    deleted: card.deleted === 0 ? null : card.deleted,
  };
  // access_code is intentionally omitted from retrieval responses
  return serialized;
}

async function getCreatorCard(serviceData, options = {}) {
  let response;

  try {
    const { slug, access_code } = serviceData;

    // find card by slug (paranoid:true means deleted=0 is enforced automatically)
    const card = await CreatorCard.findOne({ query: { slug } });

    // rule 1: card does not exist
    if (!card) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    // rule 2: card is a draft
    if (card.status === 'draft') {
      throwAppError(CreatorCardMessages.DRAFT_CARD, 'NF02');
    }

    // rule 3: private card, no access_code provided
    if (card.access_type === 'private' && !access_code) {
      throwAppError(CreatorCardMessages.PRIVATE_CARD_NO_CODE, 'AC03');
    }

    // rule 4: private card, wrong access_code
    if (card.access_type === 'private' && access_code && access_code !== card.access_code) {
      throwAppError(CreatorCardMessages.INVALID_ACCESS_CODE, 'AC04');
    }

    response = serializeCardForRetrieval(card);
  } catch (error) {
    appLogger.error({ error: error.message }, 'get-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = getCreatorCard;
