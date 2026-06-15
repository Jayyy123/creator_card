const { createHandler } = require('@app-core/server');
const getCreatorCardService = require('@app/services/creator-cards/get-creator-card');
const CreatorCardMessages = require('@app/messages/creator-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'get',
  middlewares: [],
  async handler(rc, helpers) {
    const payload = {
      slug: rc.params.slug,
      access_code: rc.query.access_code,
    };

    const card = await getCreatorCardService(payload);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.CARD_RETRIEVED,
      data: card,
    };
  },
});
