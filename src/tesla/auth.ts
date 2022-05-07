import axios from 'axios';
import * as crypto from 'crypto';

//var _0x2dc0 = ["\x65\x34\x61\x39\x39\x34\x39\x66\x63\x66\x61\x30\x34\x30\x36\x38\x66\x35\x39\x61\x62\x62\x35\x61\x36\x35\x38\x66\x32\x62\x61\x63\x30\x61\x33\x34\x32\x38\x65\x34\x36\x35\x32\x33\x31\x35\x34\x39\x30\x62\x36\x35\x39\x64\x35\x61\x62\x33\x66\x33\x35\x61\x39\x65", "\x63\x37\x35\x66\x31\x34\x62\x62\x61\x64\x63\x38\x62\x65\x65\x33\x61\x37\x35\x39\x34\x34\x31\x32\x63\x33\x31\x34\x31\x36\x66\x38\x33\x30\x30\x32\x35\x36\x64\x37\x36\x36\x38\x65\x61\x37\x65\x36\x65\x37\x66\x30\x36\x37\x32\x37\x62\x66\x62\x39\x64\x32\x32\x30"];
var _0x2dc0 = [
  "\x38\x31\x35\x32\x37\x63\x66\x66\x30\x36\x38\x34\x33\x63\x38\x36\x33\x34\x66\x64\x63\x30\x39\x65\x38\x61\x63\x30\x61\x62\x65\x66\x62\x34\x36\x61\x63\x38\x34\x39\x66\x33\x38\x66\x65\x31\x65\x34\x33\x31\x63\x32\x65\x66\x32\x31\x30\x36\x37\x39\x36\x33\x38\x34",
  "\x63\x37\x32\x35\x37\x65\x62\x37\x31\x61\x35\x36\x34\x30\x33\x34\x66\x39\x34\x31\x39\x65\x65\x36\x35\x31\x63\x37\x64\x30\x65\x35\x66\x37\x61\x61\x36\x62\x66\x62\x64\x31\x38\x62\x61\x66\x62\x35\x63\x35\x63\x30\x33\x33\x62\x30\x39\x33\x62\x62\x32\x66\x61\x33",
];

interface LoginInfo {
  url: string;
  verifier: string;
}

export async function loginPage(email: string): Promise<LoginInfo> {
  const cb = 'https://auth.tesla.com/void/callback';
  var codeVerifier = generateCodeVerifier();
  return axios.get(
    `https://auth.tesla.com/oauth2/v3/authorize?client_id=ownerapi&code_challenge=${generateCodeChallenge(codeVerifier)}&code_challenge_method=S256&locale=en&prompt=login&redirect_uri=${cb}&response_type=code&scope=openid+email+offline_access&state=${generateCodeChallenge(generateCodeVerifier())}&login_hint=${email}`,
    {
      headers: {
        "sec-fetch-site": "none",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
      }
    }).then((result) => {
      return { url: `${result.request.protocol}//${result.request.host}${result.request.path}`, verifier: codeVerifier };
    }
    );
}

export async function getToken(info: LoginInfo) {
  if (!info.url) {
    throw new Error("Login credentials rejected");
  }

  var url = require("url").parse(info.url, true);
  if (!url.query || !url.query.code) {
    throw new Error(
      "No authorization code issued; credentials likely incorrect"
    );
  }

  return axios.post((url.query.issuer || "https://auth.tesla.com/oauth2/v3") + "/token",
    {
      grant_type: "authorization_code",
      client_id: "ownerapi",
      code_verifier: info.verifier,
      code: url.query.code,
      redirect_uri: url.protocol + "//" + url.host + url.pathname,
    },
    {
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Connection: "keep-alive",
      }
    }).then(result => {
      return axios.post("https://owner-api.teslamotors.com/oauth/token",
        {
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          client_id: _0x2dc0[0],
        },
        {
          headers: {
            Authorization: "Bearer " + result.data.access_token,
          }
        });
    });
}

function generateCodeVerifier(): string {
  // Tesla might use something more sophisticated, but in my experience it's a 112-char alphanumeric string so let's just do that
  var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  var random = crypto.randomBytes(86);
  var output = "";
  for (var i = 0; i < random.length; i++) {
    output += chars[random[i] % chars.length];
  }
  return output;
}

function generateCodeChallenge(verifier: string): string {
  var hash = crypto.createHash("sha256");
  hash.update(verifier);
  return hash
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
