import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Socket } from 'node:net'
import { once } from 'node:events'
import { sendViaProvider, smtpTransport } from './providers'
import { DEFAULT_SETTINGS } from './config'

for (const rejectRecipient of [false, true]) {
  test(`SMTP test reports ${rejectRecipient ? 'recipient rejection' : 'server acceptance'} through a local SMTP server`, async () => {
    const sockets = new Set<Socket>()
    const messages: string[] = []
    let recipients = 0
    const server = createServer(socket => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
      socket.setEncoding('utf8')
      socket.write('220 localhost test SMTP\r\n')
      let buffer = '', message = '', data = false
      socket.on('data', chunk => {
        buffer += chunk
        let end: number
        while ((end = buffer.indexOf('\r\n')) >= 0) {
          const line = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          if (data) {
            if (line === '.') {
              messages.push(message); data = false
              socket.write('250 queued for local test only\r\n')
            } else message += line + '\r\n'
          } else if (/^EHLO|^HELO/.test(line)) socket.write('250-localhost\r\n250 8BITMIME\r\n')
          else if (/^MAIL FROM/.test(line)) socket.write('250 sender accepted\r\n')
          else if (/^RCPT TO/.test(line)) {
            recipients++
            socket.write(rejectRecipient ? '550 recipient rejected\r\n' : '250 recipient accepted\r\n')
          } else if (line === 'DATA') { data = true; socket.write('354 send message\r\n') }
          else if (line === 'QUIT') socket.end('221 bye\r\n')
          else socket.write('250 OK\r\n')
        }
      })
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    try {
      const address = server.address()
      assert.ok(address && typeof address !== 'string')
      const settings = { ...DEFAULT_SETTINGS, smtpHost: '127.0.0.1', smtpPort: address.port, smtpSecure: false, smtpUser: '', smtpFrom: 'sender@example.invalid' }
      const transport = smtpTransport(settings, {})
      try { assert.equal(await transport.verify(), true) } finally { transport.close() }
      assert.equal(recipients, 0, 'Connection checking must not attempt to send mail')
      assert.equal(messages.length, 0)
      const result = await sendViaProvider('email', { to: 'recipient@example.invalid', subject: 'SMTP test', text: 'SMTP test body' }, settings, {}, true)
      assert.equal(result.status, rejectRecipient ? 'failed' : 'accepted')
      assert.equal(recipients, 1)
      assert.equal(messages.length, rejectRecipient ? 0 : 1)
      if (!rejectRecipient) {
        assert.ok(messages[0].includes('SMTP test body'))
        assert.ok(result.reason?.includes('수신함 도착 여부는 확인되지 않습니다.'))
      }
    } finally {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
}
