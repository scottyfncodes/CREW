import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BottomNav } from './AppShell';
import { Home } from '../features/home/Home';
import { Schedule } from '../features/schedule/Schedule';
import { AddToSchedule } from '../features/schedule/AddToSchedule';
import { TripDetail } from '../features/schedule/TripDetail';
import { EditLeg } from '../features/schedule/EditLeg';
import { MakeSense } from '../features/makesense/MakeSense';
import { Logbook } from '../features/logbook/Logbook';
import { ReviewFlight } from '../features/logbook/ReviewFlight';
import { Tools } from '../features/tools/Tools';
import { Deck } from '../features/flightdeck/Deck';
import { Calculator } from '../features/flightdeck/Calculators';
import { AircraftCompare, AircraftList, AircraftProfile } from '../features/aircraft/AircraftProfile';
import { AirportList, AirportProfile } from '../features/airport/AirportProfile';
import { LayoverCity, LayoverHub } from '../features/layover/Layover';
import { OffDuty } from '../features/offduty/OffDuty';
import { GameScreen, PlayHub } from '../features/play/Play';
import { Settings } from '../features/settings/Settings';
import { ScrollToTop } from './ScrollToTop';

/**
 * Hash routing, deliberately.
 *
 * GitHub Pages serves static files with no rewrite rules, so a deep link to
 * /CREW/schedule/trip/abc would 404 on refresh with browser history routing.
 * Hash routes survive a reload and an "Add to Home Screen" launch, which is
 * the whole point on an iPhone.
 *
 * The information architecture is Schedule -> Today -> Flight/Layover ->
 * Logbook. Today is the app's home; Schedule is where a trip is built one
 * flight at a time or pasted in whole; Logbook is what actually happened.
 * Everything else — reference material, calculators, pay, games, settings —
 * lives under Tools.
 */
export function AppRouter() {
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/schedule" element={<Schedule />} />
          <Route path="/schedule/add" element={<AddToSchedule />} />
          <Route path="/schedule/import" element={<MakeSense />} />
          <Route path="/schedule/trip/:tripId" element={<TripDetail />} />
          <Route path="/schedule/leg/:tripId/:dayId/:legId" element={<EditLeg />} />

          <Route path="/logbook" element={<Logbook />} />
          <Route path="/logbook/review/:tripId/:dayId/:legId" element={<ReviewFlight />} />

          <Route path="/tools" element={<Tools />} />

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
          <Route path="/play/:game" element={<GameScreen />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </HashRouter>
  );
}
