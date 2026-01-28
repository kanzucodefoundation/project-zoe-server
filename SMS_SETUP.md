# SMS Feature Setup - Africa's Talking Integration

## Environment Variables

Add the following to your `.env` file:

```bash
# Africa's Talking API Credentials
AFRICASTALKING_API_KEY=your_api_key_here
AFRICASTALKING_USERNAME=your_username_here  # Use 'sandbox' for testing
```

## Getting API Credentials

1. Sign up at [Africa's Talking](https://africastalking.com/)
2. For testing: Use sandbox mode (username: `sandbox`)
3. For production: Get your production API key from the dashboard

## Endpoint Usage

### Send SMS to Group Members

**Endpoint:** `POST /api/groups/:groupId/send-sms`

**Request:**
```json
{
  "message": "Your SMS text here"
}
```

**Response:**
```json
{
  "success": true,
  "sentCount": 15,
  "totalMembers": 18,
  "skippedCount": 3
}
```

**Error Responses:**
- `404`: Group not found
- `400`: Invalid message, no valid phone numbers, or access denied
- `500`: Africa's Talking API failure

## Phone Number Format

The system accepts and normalizes Uganda phone numbers in these formats:
- `+256XXXXXXXXX` (E.164 format)
- `256XXXXXXXXX` (without +)
- `07XXXXXXXX` (local format)
- `03XXXXXXXX` (local format)

All numbers are normalized to `+256XXXXXXXXX` before sending.

## Important Notes

### ⚠️ SYNCHRONOUS IMPLEMENTATION WARNING

The current implementation is **synchronous** and will **timeout for large groups** (100+ members).

**This MUST be changed to an async job queue** (Bull, BullMQ, or similar) before production use with large groups.

**Recommended async flow:**
1. Validate request and queue job immediately
2. Return job ID: `{ jobId: "abc123", status: "queued" }`
3. Process sends in background worker
4. Frontend polls `/api/sms-jobs/:jobId` for status
5. Display progress/completion via polling or websocket

**Without async implementation:**
- ❌ Request timeouts on large groups
- ❌ Blocks the API server
- ❌ Poor user experience
- ❌ No progress tracking
- ❌ No retry mechanism

### Features Implemented

✅ Bulk SMS sending via Africa's Talking API
✅ Phone number validation and normalization
✅ Invalid number filtering
✅ Permission checks (group access)
✅ Comprehensive error handling
✅ Detailed logging

### Features NOT Implemented (TODO)

❌ Async job queue for large groups
❌ Progress tracking
❌ Retry mechanism for failed sends
❌ SMS delivery reports
❌ Rate limiting
❌ Cost estimation
❌ Message templates
❌ Scheduled sending

## Testing

### Sandbox Mode

Africa's Talking provides a sandbox for testing:

1. Set `AFRICASTALKING_USERNAME=sandbox`
2. Use sandbox API key
3. SMS won't actually send, but you'll get success responses
4. Check Africa's Talking dashboard for test logs

### Production Mode

1. Get production credentials
2. Update environment variables
3. Test with a small group first
4. Monitor Africa's Talking dashboard for delivery reports

## Cost Considerations

- Africa's Talking charges per SMS
- Bulk sending is more cost-effective than individual messages
- Monitor your account balance
- Set up billing alerts

## Security

- ✅ API key stored in environment variables (not in code)
- ✅ Permission checks before sending
- ✅ Phone number validation
- ⚠️ Consider adding rate limiting per user
- ⚠️ Consider adding daily send limits
