import { useEffect, useState } from 'react';
import type { Airport } from '../../core/types';
import type { Fetched } from '../../services/fetcher';
import { fetchForecast, fetchMetar, fetchTaf, type AirportForecast, type Metar, type Taf } from '../../services/weather';

type Loadable<T> = { loading: boolean; result: Fetched<T> | null };

const idle = <T,>(): Loadable<T> => ({ loading: true, result: null });

/** Forecast for an airport. Null airport means nothing is fetched. */
export function useForecast(airport: Airport | null, days = 2): Loadable<AirportForecast> {
  const [state, setState] = useState<Loadable<AirportForecast>>(idle);
  useEffect(() => {
    if (!airport) {
      setState({ loading: false, result: null });
      return;
    }
    let alive = true;
    setState({ loading: true, result: null });
    fetchForecast(airport, days).then((r) => {
      if (alive) setState({ loading: false, result: r });
    });
    return () => {
      alive = false;
    };
  }, [airport?.icao, days]);
  return state;
}

export function useMetar(icao: string | null): Loadable<Metar> {
  const [state, setState] = useState<Loadable<Metar>>(idle);
  useEffect(() => {
    if (!icao) {
      setState({ loading: false, result: null });
      return;
    }
    let alive = true;
    setState({ loading: true, result: null });
    fetchMetar(icao).then((r) => {
      if (alive) setState({ loading: false, result: r });
    });
    return () => {
      alive = false;
    };
  }, [icao]);
  return state;
}

export function useTaf(icao: string | null): Loadable<Taf> {
  const [state, setState] = useState<Loadable<Taf>>(idle);
  useEffect(() => {
    if (!icao) {
      setState({ loading: false, result: null });
      return;
    }
    let alive = true;
    setState({ loading: true, result: null });
    fetchTaf(icao).then((r) => {
      if (alive) setState({ loading: false, result: r });
    });
    return () => {
      alive = false;
    };
  }, [icao]);
  return state;
}
