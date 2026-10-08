import { DataProvider } from './lib/data';
import { useRoute } from './lib/router';
import { TabBar } from './components/TabBar';
import { Explore } from './pages/Explore';
import { Detail } from './pages/Detail';
import { Quiz } from './pages/Quiz';
import { Collection } from './pages/Collection';
import { Compare } from './pages/Compare';
import { StylePage } from './pages/StylePage';
import { Settings } from './pages/Settings';

export function App() {
  const [head, arg] = useRoute();
  let page;
  switch (head) {
    case 'a':
      page = <Detail key={arg} id={arg} />;
      break;
    case 'style':
      page = <StylePage key={arg} id={arg} />;
      break;
    case 'quiz':
      page = <Quiz />;
      break;
    case 'collection':
      page = <Collection />;
      break;
    case 'compare':
      page = <Compare initial={arg} />;
      break;
    case 'settings':
      page = <Settings />;
      break;
    default:
      page = <Explore />;
  }
  const tab = head === 'a' || head === 'style' ? '' : (head ?? '');
  return (
    <DataProvider>
      <main>{page}</main>
      <TabBar current={tab} />
    </DataProvider>
  );
}
