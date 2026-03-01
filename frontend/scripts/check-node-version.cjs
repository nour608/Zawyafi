const [major] = process.versions.node.split(".").map(Number)

if (major < 22 || major >= 25) {
  console.error(
    `Unsupported Node.js ${process.versions.node}. Required range is >=22 <25.`
  )
  console.error(
    "Use `nvm use` in frontend/ (or install Node 22 LTS) before running npm commands."
  )
  process.exit(1)
}
