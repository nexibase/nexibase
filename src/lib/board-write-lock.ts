import { createHash } from 'node:crypto'
import { createPool, type Pool, type RowDataPacket } from 'mysql2/promise'

let pool: Pool | undefined

export class BoardWriteBusyError extends Error {
  constructor() { super('작성 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.') }
}

// Advisory locks live in the database server's memory and need no table. Keep
// a separate connection checked out until the content transaction has committed.
// This pool is separate from Prisma so lock waiters cannot starve content writes.
export async function withBoardWriteLock<T>(authorId: number, write: () => Promise<T>): Promise<T> {
  const uri = process.env.DATABASE_URL
  if (!uri) throw new Error('DATABASE_URL is required')
  const url = new URL(uri)
  const namespace = createHash('sha256').update(decodeURIComponent(url.pathname)).digest('hex').slice(0, 16)
  const name = `nexibase:boards:${namespace}:${authorId}`
  // Prisma connection-pool query parameters are not mysql2 connection options.
  const connectionUri = new URL(uri)
  for (const key of ['connection_limit', 'pool_timeout', 'connect_timeout', 'socket_timeout']) connectionUri.searchParams.delete(key)
  pool ??= createPool({ uri: connectionUri.toString(), connectionLimit: 10, maxIdle: 5, idleTimeout: 60000 })
  const connection = await pool.getConnection()
  let reusable = false
  let acquired = false
  try {
    const [rows] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, 10) AS acquired', [name])
    acquired = Number(rows[0]?.acquired) === 1
    if (!acquired) {
      reusable = true
      throw new BoardWriteBusyError()
    }
    return await write()
  } finally {
    if (acquired) {
      try {
        const [rows] = await connection.query<RowDataPacket[]>('SELECT RELEASE_LOCK(?) AS released', [name])
        reusable = Number(rows[0]?.released) === 1
      } catch {
        reusable = false
      }
    }
    // Destroy an uncertain session rather than returning a locked connection.
    if (reusable) connection.release()
    else connection.destroy()
  }
}
