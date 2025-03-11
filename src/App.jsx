import { Analytics } from '@vercel/analytics/react';
import BasketballGame from './components/BasketballGame'

function App() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-[800px]">
        <BasketballGame />
        <Analytics />
      </div>
    </div>
  )
}

export default App