import { Route, Redirect } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Home from './pages/Home';
import EventPage from './pages/EventPage';
import JoinPage from './pages/JoinPage';
import SlideshowPage from './pages/SlideshowPage';
import { Providers } from './components/Providers';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import './index.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <Providers>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route path="/home" exact>
            <Home />
          </Route>
          <Route path="/event/:id" exact>
            <EventPage />
          </Route>
          <Route path="/event/:id/slideshow" exact>
            <SlideshowPage />
          </Route>
          <Route path="/join/:code" exact>
            <JoinPage />
          </Route>
          <Route path="/" exact>
            <Redirect to="/home" />
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </Providers>
  </IonApp>
);

export default App;
