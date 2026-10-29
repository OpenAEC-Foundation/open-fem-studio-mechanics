# Verifying the downloads

Every release of Open FEM Studio Mechanics is signed per platform. The release notes state
per platform whether that release is signed; a release that is not says so
explicitly ("niet ondertekend").

| Platform | Signature | Check |
| --- | --- | --- |
| Windows | Authenticode (installer, `open-fem-studio.exe`, `openaec-mcp-server.exe`, uninstaller), with a timestamp | Properties → Digital Signatures, or `Get-AuthenticodeSignature` |
| macOS | Developer ID, notarized by Apple, ticket stapled | `codesign`, `spctl` |
| Linux | OpenPGP: a detached `.asc` for `SHA256SUMS`, the AppImage and the `.deb` | `gpg --verify`, `sha256sum -c` |

## Linux (OpenPGP)

The releases are signed with the OpenAEC Foundation release key, the same key as the
other OpenAEC applications (see
[OpenAEC-Blueprint#37](https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint/issues/37)).

- Public key: [`openaec-releases.asc`](openaec-releases.asc)
- Key: OpenAEC Foundation Releases, ed25519, valid until 2028-10-25
- **Fingerprint (primary key): `13F6 D414 ADEE 4ED4 CD09  AC60 601D 86C9 3C50 4D29`**
- Signing subkey: `22B8 7862 8E79 C082 3E85  6D1C 402C DE27 5D38 C9B9`

Compare the fingerprint with the one on this page, not with one inside a download.

```bash
curl -LO https://raw.githubusercontent.com/OpenAEC-Foundation/open-fem-studio-mechanics/main/docs/openaec-releases.asc
gpg --show-keys --with-fingerprint openaec-releases.asc   # must show the fingerprint above
gpg --import openaec-releases.asc

# in the folder with the downloads
gpg --verify SHA256SUMS.asc SHA256SUMS
gpg --verify Open.FEM.Studio_<version>_amd64.AppImage.asc Open.FEM.Studio_<version>_amd64.AppImage
gpg --verify Open.FEM.Studio_<version>_amd64.deb.asc Open.FEM.Studio_<version>_amd64.deb
sha256sum -c --ignore-missing SHA256SUMS
```

`gpg` reports `Good signature from "OpenAEC Foundation Releases"` with the primary key
fingerprint above. The warning that the key is not certified with a trusted signature
only means you have not signed the key yourself.

## Windows

```powershell
Get-AuthenticodeSignature .\Open.FEM.Studio_<version>_x64-setup.exe | Format-List Status, SignerCertificate, TimeStamperCertificate
```

`Status` must be `Valid` and `TimeStamperCertificate` must be present.

## macOS

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/Open FEM Studio Mechanics.app"
spctl --assess --type execute --verbose=4 "/Applications/Open FEM Studio Mechanics.app"
xcrun stapler validate "/Applications/Open FEM Studio Mechanics.app"
```

`spctl` must report `accepted` and `source=Notarized Developer ID`.

## How the release workflow checks this

[`release.yml`](../.github/workflows/release.yml) signs during the build and checks
the signatures before the upload. After the draft release is uploaded, the job
`verify` downloads the published files again and checks them as above: on Windows
also the files inside the installers and, after a silent installation, the installed
files and the uninstaller; on Linux the signatures must come from the fingerprint
above. A draft release whose `verify` job fails must not be published.
