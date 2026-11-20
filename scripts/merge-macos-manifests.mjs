import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

// Resolve the same signing and YAML helpers used by the installed electron-builder.
const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve('electron-builder'))
const appBuilderRequire = createRequire(builderRequire.resolve('app-builder-lib'))
const { load } = appBuilderRequire('js-yaml')
const { createUpdateManifestSignatures, derivePublicKeyPem, loadUpdateSigningKeys, serializeToYaml } =
  appBuilderRequire('builder-util')
const { verifyManifestSignatures } = appBuilderRequire('builder-util-runtime')

const [inputDirectory, outputFile] = process.argv.slice(2)
if (!inputDirectory || !outputFile) {
  throw new Error('Informe a pasta dos manifestos e o arquivo de saída.')
}

const keys = loadUpdateSigningKeys()
if (keys.length === 0) throw new Error('Nenhuma chave de assinatura configurada.')
const publicKeys = keys.map(derivePublicKeyPem)
const manifests = []
for (const arch of ['x64', 'arm64']) {
  const content = await readFile(join(inputDirectory, `macos-${arch}`, 'latest-mac.yml'), 'utf8')
  const manifest = load(content)
  const verification = verifyManifestSignatures(manifest, publicKeys)
  if (!verification.ok) throw new Error(`Manifesto ${arch} inválido: ${verification.reason}`)
  if (!manifest.files.some(file => file.url.endsWith(`-${arch}.zip`))) {
    throw new Error(`Manifesto ${arch} sem ZIP da arquitetura esperada.`)
  }
  manifests.push(manifest)
}
if (manifests[0].version !== manifests[1].version) {
  throw new Error('Os manifestos macOS possuem versões diferentes.')
}

const { signature: _signature, signatures: _signatures, ...info } = manifests[0]
info.files = manifests.flatMap(manifest => manifest.files)
const signatures = createUpdateManifestSignatures(info, keys)
const content = serializeToYaml({ ...info, signature: signatures[0].signature, signatures }, false, true)
const verification = verifyManifestSignatures(load(content), publicKeys)
if (!verification.ok) throw new Error(`Manifesto combinado inválido: ${verification.reason}`)
await writeFile(outputFile, content)
