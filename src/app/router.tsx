import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BottomNav } from './AppShell';
import { Home } from '../features/home/Home';
import { Preflight } from '../features/preflight/Preflight';
import { MakeSense } from '../features/makesense/MakeSense';
import { AddFlight } from '../features/flights/AddFlight';
import { Deck } from '../features/flightdeck/Deck';
import { Calculator } from '../features/flightdeck/Calculators';
import { AircraftCompare, AircraftList, AircraftProfile } from '../features/aircraft/AircraftProfile';
import { AirportList, AirportProfile } from '../features/airport/AirportProfile';
import { LayoverCity, LayoverHub } from '../features/layover/Layover';
import { OffDuty } from '../features/offduty/OffDuty';
import { GameScreen, History, PlayHub } from '../features/play/Play';
import { Settings } from '../features/settings/Settings';
import { ScrollToTop } from './ScrollToTop';

/**
 * Hash routing, deliberately.
 *
 * GitHub Pages serves static files with no rewrite rules, so a deep link to
 * /CREW/deck/airport/KCLT would 404 on refresh with browser history routing.
 * Hash routes survive a reload and an "Add to Home Screen" launch, which is
 * the whole point on an iPhone.
 */
export function AppRouter() {
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/preflight" element={<Preflight />} />
          <Route path="/import" element={<MakeSense />} />
          <Route path="/flights/add" element={<AddFlight />} />

          <Route path="/deck" element={<Deck />} />
          <Route path="/deck/calc/:tool" element={<Calculator />} />
          <Route path="/deck/aircraft" element={<AircraftList />} />
          <Route path="/deck/aircraft/:id" element={<AircraftProfile />} />
          <Route path="/deck/compare" element={<AircraftCompare />} />
          <Route path="/deck/airports" element={<AirportList />} />
          <Route path="/deck/airport/:icao" element={<AirportProfile />} />

          <Route path="/layover" element={<LayoverHub />} />
          <Route path="/layover/:key" element={<LayoverCity />} />

          <Route path="/offduty" element={<OffDuty />} />

          <Route path="/play" element={<PlayHub />} />
          <Route path="/play/history" element={<History />} />
          <Route path="/play/:game" element={<GameScreen />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </HashRouter>
  );
}
