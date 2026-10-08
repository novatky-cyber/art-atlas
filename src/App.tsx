import { DataProvider } from './lib/data';
import { AuthProvider } from './lib/auth';
import { NotesProvider } from './lib/notes';
import { useRoute } from './lib/router';
import { TabBar } from './components/TabBar';
import { Notebook } from './pages/Notebook';
import { NoteEdit } from './pages/NoteEdit';
import { Checkin } from './pages/Checkin';
import { Explore } from './pages/Explore';
import { Detail } from './pages/Detail';
import { Timeline } from './pages/Timeline';
import { Settings } from './pages/Settings';
import { ArtistPage, Connect, Glossary, MuseumPage, PeriodPage, PlacePage, RegionPage, StylePage, ThemePage } from './pages/Connect';

export function App() {
  const { parts, query } = useRoute();
  const [head = '', arg] = parts;
  const key = parts.join('/');
  const page = (() => {
    switch (head) {
      case 'a': return <Detail key={key} id={arg} />;
      case 'note': return <NoteEdit key={key + query.toString()} id={arg} query={query} />;
      case 'checkin': return <Checkin />;
      case 'explore': return <Explore />;
      case 'timeline': return <Timeline />;
      case 'connect': return <Connect />;
      case 'style': return <StylePage key={key} id={arg} />;
      case 'artist': return <ArtistPage key={key} id={arg} />;
      case 'museum': return <MuseumPage key={key} id={arg} />;
      case 'place': return <PlacePage key={key} id={arg} />;
      case 'region': return <RegionPage key={key} id={arg} />;
      case 'period': return <PeriodPage key={key} id={arg} />;
      case 'theme': return <ThemePage key={key} id={arg} />;
      case 'glossary': return <Glossary key={key} id={arg} />;
      case 'settings': return <Settings />;
      default: return <Notebook />;
    }
  })();
  const tab = ['explore', 'timeline'].includes(head) ? head : ['connect', 'style', 'artist', 'museum', 'place', 'region', 'period', 'theme', 'glossary'].includes(head) ? 'connect' : head === 'a' ? 'explore' : '';
  return (
    <DataProvider>
      <AuthProvider>
        <NotesProvider>
          <main>{page}</main>
          <TabBar current={tab} />
        </NotesProvider>
      </AuthProvider>
    </DataProvider>
  );
}
