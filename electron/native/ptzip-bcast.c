/* ptzIP read-only broadcast sender.
 * Usage: ptzip-bcast <interface> <source-port> <dest-port> <hex-payload>
 * Sends one UDP datagram to 255.255.255.255:<dest-port> pinned to <interface>.
 * macOS otherwise sends the all-hosts broadcast only out the default-route adapter
 * (e.g. a phone hotspot), so cameras on the wired switch never hear the search. */
#include <arpa/inet.h>
#include <net/if.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>
static int hexval(char c){ if(c>='0'&&c<='9')return c-'0'; if(c>='a'&&c<='f')return c-'a'+10; if(c>='A'&&c<='F')return c-'A'+10; return -1; }
int main(int argc, char **argv) {
  if (argc != 5) { fprintf(stderr, "usage\n"); return 2; }
  const char *ifname = argv[1]; int sport = atoi(argv[2]), dport = atoi(argv[3]); const char *hex = argv[4];
  size_t n = strlen(hex); if (n == 0 || n % 2 || n > 2048 || dport < 1 || dport > 65535 || sport < 0 || sport > 65535) { fprintf(stderr, "bad arguments\n"); return 2; }
  unsigned char buf[1024]; for (size_t i = 0; i < n / 2; i++) { int a = hexval(hex[2*i]), b = hexval(hex[2*i+1]); if (a < 0 || b < 0) { fprintf(stderr, "bad hex\n"); return 2; } buf[i] = (unsigned char)(a * 16 + b); }
  unsigned int idx = if_nametoindex(ifname); if (!idx) { perror("if_nametoindex"); return 3; }
  int s = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP); if (s < 0) { perror("socket"); return 3; }
  int on = 1; setsockopt(s, SOL_SOCKET, SO_BROADCAST, &on, sizeof on); setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &on, sizeof on);
#ifdef SO_REUSEPORT
  setsockopt(s, SOL_SOCKET, SO_REUSEPORT, &on, sizeof on);
#endif
#if defined(__APPLE__)
  if (setsockopt(s, IPPROTO_IP, IP_BOUND_IF, &idx, sizeof idx) < 0) { perror("IP_BOUND_IF"); return 4; }
#elif defined(__linux__)
  if (setsockopt(s, SOL_SOCKET, SO_BINDTODEVICE, ifname, strlen(ifname)) < 0) { perror("SO_BINDTODEVICE"); return 4; }
#endif
  struct sockaddr_in src; memset(&src, 0, sizeof src); src.sin_family = AF_INET; src.sin_addr.s_addr = htonl(INADDR_ANY); src.sin_port = htons((unsigned short)sport);
  if (bind(s, (struct sockaddr *)&src, sizeof src) < 0) { src.sin_port = 0; if (bind(s, (struct sockaddr *)&src, sizeof src) < 0) { perror("bind"); return 5; } }
  struct sockaddr_in dst; memset(&dst, 0, sizeof dst); dst.sin_family = AF_INET; dst.sin_port = htons((unsigned short)dport); dst.sin_addr.s_addr = htonl(INADDR_BROADCAST);
  if (sendto(s, buf, n / 2, 0, (struct sockaddr *)&dst, sizeof dst) < 0) { perror("sendto"); return 6; }
  close(s); return 0;
}
