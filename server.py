#!/usr/bin/env python3
"""Dev server with no-cache headers so file changes reload instantly."""
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass  # suppress request logs

with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'AP Ops dev server: http://localhost:{PORT}')
    httpd.serve_forever()
