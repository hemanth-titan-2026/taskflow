# Cloudflare CDN Configuration

## DNS Setup

1. Add your domain to Cloudflare
2. Update nameservers at your registrar
3. Create DNS records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | `<EC2-PUBLIC-IP>` | Proxied (orange cloud) |
| A | api | `<EC2-PUBLIC-IP>` | Proxied |
| CNAME | www | `@` | Proxied |

## SSL/TLS Configuration

- **Mode**: Full (strict)
- **Minimum TLS**: 1.2
- **Always Use HTTPS**: Enabled
- **Automatic HTTPS Rewrites**: Enabled
- Origin Certificate: Generate via Cloudflare and install on EC2

## Caching Rules

### Cache Everything (API responses are excluded by default via Cache-Control headers)

**Page Rule 1** - Static assets:
- URL: `*taskflow.app/static/*`
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 year

**Page Rule 2** - API no-cache:
- URL: `*taskflow.app/api/*`
- Cache Level: Bypass

**Page Rule 3** - WebSocket passthrough:
- URL: `*taskflow.app/socket.io/*`
- Cache Level: Bypass
- Disable Apps
- Disable Performance

## Security Settings

### WAF Rules
- **Bot Fight Mode**: Enabled
- **Security Level**: Medium
- **Challenge Passage**: 30 minutes
- **Browser Integrity Check**: Enabled

### Rate Limiting (Cloudflare-level)
Create rules via Cloudflare Dashboard > Security > WAF > Rate limiting rules:

1. **Auth endpoints**: `/api/v1/auth/*` - 10 requests per 10 seconds per IP
2. **API general**: `/api/*` - 100 requests per 10 seconds per IP
3. **Health endpoint**: Exclude from rate limiting

### Firewall Rules
- Allow only Cloudflare IPs to reach your EC2 (configure Security Group)
- Block known bad user agents
- Challenge requests from high-risk countries (if applicable)

## Performance

### Speed Settings
- **Auto Minify**: JS, CSS, HTML
- **Brotli**: Enabled
- **Early Hints**: Enabled
- **HTTP/2**: Enabled
- **HTTP/3**: Enabled

### Network
- **WebSockets**: Enabled (required for Socket.IO)
- **gRPC**: Disabled (not used)
- **Onion Routing**: Disabled

## Cloudflare Workers (Optional)

For advanced routing or edge-side logic, deploy a Worker:

```javascript
// Example: Add security headers at the edge
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const response = await fetch(request);
  const newResponse = new Response(response.body, response);

  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return newResponse;
}
```

## AWS Security Group Configuration

Only allow inbound from Cloudflare IP ranges:
- https://www.cloudflare.com/ips-v4
- https://www.cloudflare.com/ips-v6

```bash
# Example: Update security group to only allow Cloudflare IPs
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 173.245.48.0/20
```

## Monitoring

- Enable **Analytics** in Cloudflare dashboard
- Set up **Health Checks** pointing to `/health`
- Configure **Notifications** for origin downtime
