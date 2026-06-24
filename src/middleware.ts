import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifyToken } from '@/lib/session';

// Absolute redirect that targets the PUBLIC host when behind a proxy/tunnel
// (uses X-Forwarded-Host/Proto if present), so it never points at the
// internal origin (e.g. localhost:8080).
function redirectTo(req: NextRequest, path: string) {
  const url = new URL(path, req.url);
  const fwdHost = req.headers.get('x-forwarded-host');
  const fwdProto = req.headers.get('x-forwarded-proto');
  if (fwdHost) url.host = fwdHost.split(',')[0].trim();
  if (fwdProto) url.protocol = `${fwdProto.split(',')[0].trim()}:`;
  // Behind an HTTPS proxy the public endpoint is on 443 — drop any internal port.
  if (url.protocol === 'https:') url.port = '';
  return NextResponse.redirect(url);
}

// Protects pages and APIs. Auth endpoints stay public so users can log in.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  const isApi = pathname.startsWith('/api');
  const isAuthApi = pathname.startsWith('/api/auth');

  if (isApi) {
    if (isAuthApi) return NextResponse.next();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Page routes
  if (pathname === '/login') {
    if (session) return redirectTo(req, '/');
    return NextResponse.next();
  }

  if (!session) {
    return redirectTo(req, '/login');
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
};
