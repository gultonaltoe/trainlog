import { getSessionTypes } from '@/lib/api'

export default async function Home() {
  const types = await getSessionTypes()
  return (
    <main style={{ padding: 40 }}>
      <h1>Trainlog ✅</h1>
      <pre>{JSON.stringify(types, null, 2)}</pre>
    </main>
  )
}