import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function app() {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-gavve' })
  }
  return getApps()[0]
}

export function firebaseAuth() {
  return getAuth(app())
}
