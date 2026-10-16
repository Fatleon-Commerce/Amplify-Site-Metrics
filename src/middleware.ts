import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const script = pathname.match(/^\/([a-z0-9]{8})\.js$/);
  if (script) {
    const url = request.nextUrl.clone();
    url.pathname = `/s/${script[1]}`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/admin" || (pathname.startsWith("/admin/") && pathname !== "/admin/login")) {
    if (!request.cookies.get("sm_admin")?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
