import Layout from '../components/Layout';

export default function PerpPage() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-96 space-y-6">
        <div className="text-8xl">🔮</div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Perp Trading</h2>
          <div className="inline-block bg-gray-800 rounded-full px-6 py-2 mb-4">
            <span className="text-yellow-400 font-semibold">Coming Soon</span>
          </div>
          <p className="text-gray-400 text-sm max-w-xs">
            Perpetual futures trading powered by AI agents is currently under development.
          </p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Planned Features</p>
          <div className="space-y-2 text-sm text-gray-300">
            <p>🤖 AI-driven position management</p>
            <p>📊 Dynamic leverage adjustment</p>
            <p>🛡️ Auto stop-loss protection</p>
            <p>⚡ x402 payment integration</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
