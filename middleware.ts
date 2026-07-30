import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Jika diakses dari domain driver dan membuka halaman depan ('/')
  if (host.includes('fleetmate-driver') && pathname === '/') {
    // Tampilkan isi halaman /driver secara otomatis
    return NextResponse.rewrite(new URL('/driver', request.url));
  }

  return NextResponse.next();
}