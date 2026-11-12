# Session 001 fact check

Checked against Apple Support on 2026-11-12. The script is kept verbatim.

| Identifier | Apple component | Apple disclosure in summary |
| --- | --- | --- |
| CVE-2026-113970 | Bluetooth | A use-after-free could permit process memory corruption from within Bluetooth range. Apple improved memory management. |
| CVE-2026-113965 | CoreUtils | A malicious Bluetooth device could pair without user interaction. Apple improved checks. |
| CVE-2026-113964 | CoreUtils | A logic issue could allow the pairing-code attempt rate limit to be bypassed and permit pairing without user interaction. Apple improved state management. |

Sources [iOS 26.7.3 and iPadOS 26.7.3](https://support.apple.com/en-us/149716) and [iOS 18.7.12 and iPadOS 18.7.12](https://support.apple.com/en-us/149717).

The disclosures do not establish a shared root cause or a vulnerability chain. Actual exploitation, remote code execution, an asynchronous ownership transition, and a connection to WebKit remain unconfirmed. The discussion of PAC and object lifetime is general background.
