const { createHandler } = require('@app-core/server');
const deleteCreatorCardService = require('@app/services/creator-cards/delete-creator-card');
const CreatorCardMessages = require('@app/messages/creator-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'delete',
  middlewares: [],
  async handler(rc, helpers) {
    const payload = {
      ...rc.body,
      slug: rc.params.slug,
    };

    const card = await deleteCreatorCardService(payload);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.CARD_DELETED,
      data: card,
    };
  },
});
