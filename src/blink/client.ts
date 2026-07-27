import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'glam-classified-app-xuv5nnly',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_WgsCyiz8zsuhvY1STYYSqQT2BgYrCAhs',
  authRequired: false,
  auth: { mode: 'managed' },
})
