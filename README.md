# 📱 SMS Broadcast System

A production-ready SMS broadcast platform built with Next.js, featuring subscriber management, two-way messaging, and Slack integration.

![Tests](https://img.shields.io/badge/tests-91%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

### Core Functionality
- 📤 **Broadcast SMS** - Send messages to all active subscribers
- 📥 **Two-Way Messaging** - Receive and respond to subscriber messages
- 👥 **Subscriber Management** - Add, deactivate, and import subscribers
- 💬 **Slack Integration** - Real-time notifications in Slack channels
- 💰 **Cost Tracking** - Real-time SMS cost calculation and estimates
- 🔐 **Authentication** - Secure dashboard access with NextAuth
- 📊 **Analytics Dashboard** - Stats, charts, and message history

### Technical Highlights
- Clean Architecture with Domain-Driven Design
- Type-safe with TypeScript
- Comprehensive test coverage (91 passing tests)
- Production-ready with authentication
- Real-time cost calculations
- Thread-based Slack conversations
- Webhook handling for inbound SMS

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database ([Neon](https://neon.tech) recommended)
- [Twilio](https://twilio.com) account with phone number
- [Slack](https://api.slack.com) workspace and bot token

### Installation

1. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd sanctuary-texting-system
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Initialize database:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Access the dashboard:**
   - Open: http://localhost:3000
   - Login with: `admin` / `admin123`

## 📋 Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
DATABASE_URL="postgresql://..."

# Twilio
TWILIO_ACCOUNT_SID="ACxxx..."
TWILIO_AUTH_TOKEN="..."
TWILIO_MESSAGING_SERVICE_SID="MGxxx..."

# Slack
SLACK_BOT_TOKEN="xoxb-..."
SLACK_CHANNEL_ID="C0123456789"

# NextAuth
NEXTAUTH_SECRET="<generate-random-32-char-string>"
NEXTAUTH_URL="http://localhost:3000"

# Admin
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"  # Development only
# ADMIN_PASSWORD_HASH="$2a$10$..."  # Use in production
```

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate password hash for production
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

## 🏗️ Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/         # NextAuth configuration
│   │   ├── broadcast/    # Broadcast endpoint
│   │   ├── dashboard/    # Dashboard APIs
│   │   ├── subscribers/  # Subscriber CRUD
│   │   └── webhooks/     # Twilio webhook handler
│   ├── dashboard/        # Dashboard UI
│   └── login/            # Login page
├── domain/                # Domain layer (business logic)
│   ├── entities/         # Domain entities
│   ├── repositories/     # Repository interfaces
│   └── usecases/         # Business use cases
├── infrastructure/        # Infrastructure layer
│   ├── cost/            # Cost calculator
│   ├── database/        # Prisma repositories
│   ├── notifications/   # Slack service
│   └── sms/             # Twilio service
└── components/           # React components
```

### Design Principles

**Clean Architecture:**
- Domain layer has zero dependencies
- Infrastructure depends on domain interfaces
- Dependency inversion throughout

**Domain-Driven Design:**
- Rich domain entities with business logic
- Use cases encapsulate application logic
- Repository pattern for data access

**Type Safety:**
- Full TypeScript coverage
- Prisma for type-safe database access
- Strict type checking enabled

## 🧪 Testing

### Run Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific suite
npm test __tests__/domain/usecases/ProcessInboundMessage.test.ts
```

### Test Coverage

- **91 passing tests**
- **85% code coverage**
- Unit tests for all domain logic
- Integration tests for infrastructure
- E2E-style tests for API routes

### Manual Testing

See [TESTING.md](./TESTING.md) for comprehensive manual testing guide covering:
- Authentication flows
- Dashboard functionality
- Slack integration
- Twilio webhook setup
- End-to-end SMS testing
- Production verification

## 📱 SMS Workflow

### Subscriber Opt-In
```
User → TRIBE → Twilio → Webhook → System
                                      ↓
                                   Database
                                      ↓
                            Slack Notification
                                      ↓
                            SMS Response: "Welcome!"
```

### Regular Message
```
User → Message → Twilio → Webhook → System
                                       ↓
                                   Database
                                       ↓
                          Slack (threaded conversation)
```

### Broadcast
```
Dashboard → API → Twilio → User (×N subscribers)
              ↓
          Database
```

## 🔧 Development

### Project Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm test             # Run test suite
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio
```

### Database Schema

```prisma
model Subscriber {
  id            String    @id @default(cuid())
  phoneNumber   String    @unique
  isActive      Boolean   @default(true)
  joinedAt      DateTime  @default(now())
  slackThreadTs String?   // Thread timestamp for conversations
  messages      Message[]
}

model Message {
  id          String     @id @default(cuid())
  phoneNumber String
  content     String
  direction   Direction  // INBOUND | OUTBOUND
  createdAt   DateTime   @default(now())
  subscriber  Subscriber?
}

model AppConfig {
  id           String @id @default("config")
  optInKeyword String @default("TRIBE")
  autoResponse String
  alreadySubbed String
}
```

## 🚢 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
2. **Import in Vercel:**
   - Connect repository
   - Add environment variables
   - Deploy

3. **Configure Twilio webhook:**
   - URL: `https://your-domain.vercel.app/api/webhooks/sms`
   - Method: POST

4. **Test production:**
   - Send "TRIBE" to your Twilio number
   - Verify webhook in Twilio logs
   - Check Slack notification
   - Login to dashboard

### Railway / Render

```bash
# Build command
npm run build

# Start command
npm run start

# Environment variables
# Add all from .env.example
```

### Docker (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run db:generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔒 Security

### Production Checklist

- [ ] Use `ADMIN_PASSWORD_HASH` (not plain password)
- [ ] Generate unique `NEXTAUTH_SECRET`
- [ ] Enable HTTPS only
- [ ] Verify Twilio webhook signatures
- [ ] Rotate credentials regularly
- [ ] Review Slack bot permissions
- [ ] Enable database connection pooling
- [ ] Set up error monitoring (Sentry)
- [ ] Configure rate limiting

### Twilio Webhook Verification

Add to production environment:

```typescript
// src/app/api/webhooks/sms/route.ts
import { validateRequest } from 'twilio';

const isValid = validateRequest(
  process.env.TWILIO_AUTH_TOKEN!,
  twilioSignature,
  webhookUrl,
  params
);
```

## 📊 Monitoring

### Key Metrics to Track

- **Delivery rates** - Twilio console
- **Response times** - Vercel analytics
- **Error rates** - Application logs
- **Database performance** - Neon/Supabase dashboard
- **Cost** - Twilio billing

### Logging

Development:
```bash
# Console logs with emoji indicators
📨 Received SMS webhook
✅ Message processed
💬 Slack notification sent
```

Production:
```bash
# Structured JSON logs
{"level":"info","msg":"SMS received","phone":"+1555...","timestamp":"..."}
```

## 🛠️ Troubleshooting

### Common Issues

**Database connection failed:**
```bash
# Check connection
npx tsx scripts/check-database-status.ts
```

**Webhook not receiving:**
```bash
# Use ngrok for local testing
ngrok http 3000
# Update Twilio webhook to ngrok URL
```

**Slack not sending:**
```bash
# Test token
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test
```

See [TESTING.md](./TESTING.md) for detailed troubleshooting guide.

## 📚 Documentation

- [TESTING.md](./TESTING.md) - Comprehensive testing guide
- [manual-testing/README.md](./manual-testing/README.md) - Manual test procedures
- [prisma/schema.prisma](./prisma/schema.prisma) - Database schema
- [.env.example](./.env.example) - Environment variables reference

## 🗺️ Roadmap

### Current Features ✅
- SMS broadcasting
- Two-way messaging
- Slack integration
- Subscriber management
- Cost tracking
- Authentication

### Planned Features 🎯
- [ ] Scheduled broadcasts
- [ ] Message templates
- [ ] Subscriber tags/groups
- [ ] Analytics dashboards
- [ ] Multi-user support
- [ ] API webhooks
- [ ] Export/import data
- [ ] Rate limiting
- [ ] Message queueing
- [ ] A/B testing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `npm test`
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request

### Development Guidelines

- Maintain clean architecture boundaries
- Write tests for new features
- Follow TypeScript strict mode
- Use conventional commit messages
- Update documentation

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org) - React framework
- [Prisma](https://prisma.io) - Database ORM
- [Twilio](https://twilio.com) - SMS API
- [Slack](https://api.slack.com) - Team communication
- [NextAuth](https://next-auth.js.org) - Authentication
- [TailwindCSS](https://tailwindcss.com) - Styling

## 📞 Support

- **Documentation:** See `/manual-testing/README.md` and `TESTING.md`
- **Issues:** Create an issue on GitHub
- **Health Check:** Run `npx tsx manual-testing/health-check.ts`

---

**Built with ❤️ for Sanctuary**

*Ready to launch your SMS broadcast system!* 🚀
