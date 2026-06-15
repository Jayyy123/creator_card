# Creator Cards API

A microservice API that lets creators publish shareable profile cards with links and service rates. Built with Node.js, Express, and MongoDB.

**Live URL:** `https://creator-cards-api-aace412f761c.herokuapp.com`

---

## What This Does

Creator Cards is a "link-in-bio" style API. Creators can create a card with their name, links (YouTube, Instagram, etc.), and service rates (how much they charge for sponsored posts, features, etc.). Each card gets a unique slug that can be shared publicly. Cards can be public or private (protected by a 6-character access code).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/creator-cards` | Create a new creator card |
| `GET` | `/creator-cards/:slug` | Retrieve a published card by slug |
| `DELETE` | `/creator-cards/:slug` | Soft-delete a card by slug |

### Key Features

- ULID-based IDs stored as `_id` in MongoDB, serialized as `id` in API responses
- Slug auto-generation from title when not provided
- Private cards with 6-character alphanumeric access codes
- Draft cards that are never publicly retrievable
- Paranoid soft-delete (cards are marked deleted, not removed)
- VSL validation for field-level rules, custom business rule error codes for everything else

---

## Project Structure

```
├── endpoints/
│   └── creator-cards/
│       ├── create.js              # POST /creator-cards
│       ├── retrieve.js            # GET /creator-cards/:slug
│       └── delete.js              # DELETE /creator-cards/:slug
├── services/
│   └── creator-cards/
│       ├── create-creator-card.js # validation, slug gen, access rules
│       ├── get-creator-card.js    # retrieval with access control
│       └── delete-creator-card.js # soft delete
├── models/
│   └── creator-card.js            # Mongoose schema
├── repository/
│   └── creator-card/index.js      # Data access layer
├── messages/
│   └── creator-card.js            # Error/success message constants
├── core/                          # Framework utilities (do not modify)
├── .github/
│   └── workflows/deploy.yml       # Auto-deploy to Heroku on push to main
├── Procfile                       # Heroku process definition
└── bootstrap.js                   # App entry point
```

---

## Getting Started

### Prerequisites

- Node.js v16+
- MongoDB Atlas account (free tier works)
- Heroku account (for deployment)

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/Jayyy123/creator_card.git
   cd creator_card
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your values:
   ```
   PORT=3000
   APP_NAME=CreatorCards
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/creator_cards_db?retryWrites=true&w=majority
   ```

4. Start the server:
   ```bash
   node bootstrap.js
   ```

5. Test it:
   ```bash
   curl -X POST http://localhost:3000/creator-cards \
     -H "Content-Type: application/json" \
     -d '{"title":"Test Card","creator_reference":"crt_8f2k1m9x4p7w3q5z","status":"published"}'
   ```

---

## Branching & Deployment

### Branch Strategy

- `main` — production branch, auto-deploys to Heroku
- `staging` — development branch, PRs are made from here

### Workflow

1. Work on `staging` branch
2. Push to `origin staging`
3. Open a PR from `staging` → `main`
4. Squash and merge
5. GitHub Actions auto-deploys to Heroku

### Deployment Pipeline

On every push to `main`, the GitHub Actions workflow at `.github/workflows/deploy.yml` pushes the code to the Heroku git remote. The pipeline uses the `HEROKU_API_KEY` secret stored in GitHub repo settings.

**Heroku app:** `creator-cards-api`
**Live URL:** `https://creator-cards-api-aace412f761c.herokuapp.com`

---

## Custom Error Codes

| Error Code | HTTP | Meaning |
|------------|------|---------|
| `SL02` | 400 | Slug is already taken |
| `AC01` | 400 | access_code required for private cards |
| `AC05` | 400 | access_code not allowed on public cards |
| `NF01` | 404 | Card not found |
| `NF02` | 404 | Card exists but is a draft |
| `AC03` | 403 | Private card, access code required |
| `AC04` | 403 | Invalid access code |

---

## Adding New APIs

This project follows the template's layered architecture. To add a new feature:

### 1. Create Message Constants

**Location:** `messages/[resource].js`

```javascript
const MyMessages = {
  CREATED: 'Resource created successfully.',
  NOT_FOUND: 'Resource not found',
};

module.exports = MyMessages;
```

Register in `messages/index.js`.

### 2. Create a Model

**Location:** `models/[resource].js`

```javascript
const { ModelSchema, SchemaTypes, DatabaseModel } = require('@app-core/mongoose');
const timestamps = require('./plugins/timestamps');

const modelName = 'my_resources';
const schemaConfig = {
  _id: { type: SchemaTypes.ULID },
  name: { type: SchemaTypes.String },
};

const modelSchema = new ModelSchema(schemaConfig, { collection: modelName });
modelSchema.plugin(timestamps);

module.exports = DatabaseModel.model(modelName, modelSchema, { paranoid: true });
```

Register in `models/index.js`.

### 3. Create a Repository

**Location:** `repository/[resource]/index.js`

```javascript
const repositoryFactory = require('@app-core/repository-factory');
module.exports = repositoryFactory('MyResource', {});
```

### 4. Create Services

**Location:** `services/[resource]/[action].js`

Services follow these rules:
- Two parameters only: `(serviceData, options = {})`
- Validate input first with VSL
- Single exit point (one `return`)
- Use `throwAppError` for errors, never `throw new Error`

```javascript
const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const Messages = require('@app/messages/my-resource');

const spec = `root {
  name string<trim|minLength:3>
}`;

const parsedSpec = validator.parse(spec);

async function createMyResource(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedSpec);
  let response;

  try {
    // business logic here
  } catch (error) {
    throw error;
  }

  return response;
}

module.exports = createMyResource;
```

### 5. Create Endpoints

**Location:** `endpoints/[resource]/[action].js`

```javascript
const { createHandler } = require('@app-core/server');
const createMyResource = require('@app/services/my-resource/create');

module.exports = createHandler({
  path: '/my-resources',
  method: 'post',
  middlewares: [],
  async handler(rc, helpers) {
    const payload = rc.body;
    const result = await createMyResource(payload);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: 'Resource created',
      data: result,
    };
  },
});
```

### 6. Register in app.js

```javascript
const ENDPOINT_CONFIGS = [
  { path: './endpoints/my-resources/' },
];
```

---

## Validator Quick Reference (VSL)

```javascript
// Types: string, number, boolean, object, any
// Modifiers: field? (optional), field[] (array), field[]? (optional array)

const spec = `root {
  name string<trim|minLength:3|maxLength:100>
  email string<trim|lowercase|isEmail>
  age? number<min:18>
  status string(active|inactive)
  tags[]? string<trim>
}`;
```

**Constraints:** `trim`, `lowercase`, `uppercase`, `minLength`, `maxLength`, `length`, `min`, `max`, `between`, `startsWith`, `endsWith`, `isEmail`

---

## Common Pitfalls

- Always include a **space** between `root` and `{` in VSL specs
- Never use `console.log` — use `appLogger` from `@app-core/logger`
- Never use `required: true` or `enum: []` in models — validation belongs in services
- Use `@app-core/` and `@app/` path aliases, not relative paths like `../../core/`
- No regex allowed — use string methods only (`.split()`, `.indexOf()`, `.startsWith()`, etc.)

---

> 📖 **For comprehensive architecture documentation, see [documentation.md](./documentation.md)**
