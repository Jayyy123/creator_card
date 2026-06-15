const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCardMessages = require('@app/messages/creator-card');
const CreatorCard = require('@app/repository/creator-card');
const { serializeCard } = require('./create-creator-card');

const spec = `root {
  creator_reference string<length:20>
}`;

const parsedSpec = validator.parse(spec);

async function deleteCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedSpec);
  let response;

  try {
    const { slug } = serviceData;

    // find the card
    const card = await CreatorCard.findOne({ query: { slug } });

    if (!card) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    // soft delete - set deleted timestamp
    const now = Date.now();
    await CreatorCard.updateOne({
      query: { _id: card._id },
      updateValues: { deleted: now, updated: now },
    });

    // return the card in creation response format with deleted set
    card.deleted = now;
    card.updated = now;

    response = serializeCard(card);
  } catch (error) {
    appLogger.error({ error: error.message }, 'delete-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = deleteCreatorCard;
