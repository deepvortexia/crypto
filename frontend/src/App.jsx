import Header          from './components/Header'
import HeroStats       from './components/HeroStats'
import PredictionCards from './components/PredictionCards'
import PriceChart      from './components/PriceChart'
import IndicatorsPanel from './components/IndicatorsPanel'
import SentimentGauge  from './components/SentimentGauge'
import OnchainPanel    from './components/OnchainPanel'
import AccuracyPanel   from './components/AccuracyPanel'

export default function App() {
  return (
    <>
      <div className="scan-line" aria-hidden="true" />
      <Header />
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <HeroStats />
        <PredictionCards />
        <PriceChart />
        <IndicatorsPanel />
        <SentimentGauge />
        <OnchainPanel />
        <AccuracyPanel />
      </main>
    </>
  )
}
