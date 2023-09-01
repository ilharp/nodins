import { rm } from 'fs/promises'
import { resolve } from 'node:path'

void Promise.all(
  [
    '../build',
    '../packages/nodins/lib',
    '../packages/nodins/tsconfig.tsbuildinfo',
  ].map((x) =>
    rm(resolve(__dirname, x), {
      force: true,
      recursive: true,
    }),
  ),
)
