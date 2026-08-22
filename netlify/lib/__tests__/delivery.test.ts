import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Delivery } from '../delivery'
import { emailReadiness, linkFor, sendViaResend } from '../delivery-resend'

const INVITE: Delivery = {
  kind: 'invitation',
  email: 'samuel.story-taylor@polycohealthline.com',
  token: 'a-token-that-must-not-be-logged',
  expiresAt: '2026-08-29T09:00:00.000Z',
}

const FULL_ENV = {
  EMAIL_SENDING_ENABLED: 'true',
  RESEND_API_KEY: 'test-key',
  EMAIL_FROM: 'dashboard@ecofibre.bh',
  PUBLIC_BASE_URL: 'https://dashboard.ecofibre.bh/',
} as unknown as NodeJS.ProcessEnv

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('email readiness', () => {
  it('is shut with nothing configured', () => {
    expect(emailReadiness({} as NodeJS.ProcessEnv)).toEqual({
      ready: false,
      reason: 'sending is switched off',
    })
  })

  it('stays shut when a key arrives but the switch has not been thrown', () => {
    // The point of the separate switch. A key appearing in the environment must
    // not start sending on its own.
    const env = { ...FULL_ENV, EMAIL_SENDING_ENABLED: undefined } as NodeJS.ProcessEnv
    expect(emailReadiness(env).ready).toBe(false)
  })

  it('names what is missing rather than failing silently', () => {
    const noKey = { ...FULL_ENV, RESEND_API_KEY: undefined } as NodeJS.ProcessEnv
    const noFrom = { ...FULL_ENV, EMAIL_FROM: undefined } as NodeJS.ProcessEnv
    expect(emailReadiness(noKey)).toEqual({ ready: false, reason: 'no RESEND_API_KEY' })
    expect(emailReadiness(noFrom)).toEqual({ ready: false, reason: 'no EMAIL_FROM' })
  })

  it('is ready when all four are set, with the trailing slash trimmed', () => {
    const readiness = emailReadiness(FULL_ENV)
    expect(readiness.ready).toBe(true)
    if (readiness.ready) expect(readiness.baseUrl).toBe('https://dashboard.ecofibre.bh')
  })
})

describe('sending', () => {
  it('does not call Resend at all while sending is off', async () => {
    const fetched = vi.fn()
    vi.stubGlobal('fetch', fetched)

    const result = await sendViaResend(INVITE, {} as NodeJS.ProcessEnv)

    expect(fetched).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: false, reason: 'sending is switched off' })
  })

  it('posts to Resend with the key in the header and the link in the body', async () => {
    const fetched = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetched)

    expect(await sendViaResend(INVITE, FULL_ENV)).toEqual({ sent: true })

    const [url, init] = fetched.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key')

    const body = JSON.parse(init.body as string)
    expect(body.to).toEqual([INVITE.email])
    expect(body.from).toBe('dashboard@ecofibre.bh')
    expect(body.text).toContain(
      'https://dashboard.ecofibre.bh/invite#a-token-that-must-not-be-logged',
    )
    expect(body.subject).toMatch(/access/i)
  })

  it('reports an upstream failure by status, without repeating what it said', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"domain not verified"}', { status: 403 })),
    )
    expect(await sendViaResend(INVITE, FULL_ENV)).toEqual({
      sent: false,
      reason: 'Resend returned 403',
    })
  })

  it('keeps the token in the fragment, which the browser never sends', () => {
    const invite = linkFor(INVITE, 'https://dashboard.ecofibre.bh')
    const reset = linkFor({ ...INVITE, kind: 'reset' }, 'https://dashboard.ecofibre.bh')

    expect(invite).toBe('https://dashboard.ecofibre.bh/invite#a-token-that-must-not-be-logged')
    expect(reset).toBe('https://dashboard.ecofibre.bh/reset#a-token-that-must-not-be-logged')

    // The path a server would see and log carries nothing.
    expect(new URL(invite).pathname).toBe('/invite')
    expect(new URL(invite).search).toBe('')
  })
})
