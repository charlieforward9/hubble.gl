This is a video export-enabled version of the [TripsLayer example](https://deck.gl/examples/trips-layer/)
on [deck.gl](http://deck.gl) website.

### Purpose

Users can drag, zoom in and zoom out, change pitch and bearing from within the deckgl canvas. The camera will start at the last position (viewState) the user was at, improving the experience of exporting the camera movements.

![](https://user-images.githubusercontent.com/26909101/92542712-25c01d00-f20f-11ea-9aee-1bc2806685dc.gif)

### Usage

Copy the content of this folder to your project. 

Other options can be found at [using with Maplibre GL](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre).

### Installation

```bash
# install dependencies within hubble.gl root
yarn bootstrap
# To install example go to the folder 
cd examples/trips
# do this once per example
yarn 
# To run the example
yarn start-local
```

### Data format
Sample data is stored in [deck.gl Example Data](https://github.com/visgl/deck.gl-data/tree/master/examples/trips). To use your own data, check out
the [documentation of TripsLayer](https://deck.gl/docs/api-reference/geo-layers/trips-layer).

### How to add this feature to a hubble.gl example

1. Define hubble.gl react hooks

```jsx
import React, {useRef} from 'react';
import {useDeckAnimation, useHubbleGl} from '@hubble.gl/react';

const initialViewState = {...};

function Visualization() {
  const deckRef = useRef(null);
  const mapRef = useRef(null);
  const deckAnimation = useDeckAnimation({
    getLayers: a =>
      a.applyLayerKeyframes([
         // move deck layer definitions to here
      ]),
    layerKeyframes: ...
    cameraKeyframe: ...
  });

  const {
    deckProps, 
    mapProps,          // optional, use for basemap
    adapter,           // optional, use to modify animation at run time
    cameraFrame,       // optional, use for camera animation
    setCameraFrame     // optional, use for camera animation
  } = useHubbleGl({
      deckRef,
      mapRef,          // optional, use for basemap
      deckAnimation,
      initialViewState // optional, use for camera animation
  });
  
  ...
```

2. Define animation and export settings

```js
const formatConfigs = {
  // optional, override default quality settings
};

const resolution = {
  width: 1280,
  height: 720
};

const timecode = {
  start: 0,
  end: 5000,
  framerate: 30
};
```

3. Define an interleaved deck.gl MapboxOverlay

```jsx
import {forwardRef} from 'react';
import Map, {useControl} from 'react-map-gl';
import {MapboxOverlay} from '@deck.gl/mapbox';

const DeckGLOverlay = forwardRef((props, ref) => {
  // MapboxOverlay handles a variety of props differently than the Deck class.
  // https://deck.gl/docs/api-reference/mapbox/mapbox-overlay#constructor
  const deck = useControl(() => new MapboxOverlay({...props, interleaved: true}));
  deck.setProps(props);
  ref.current = deck._deck;
  return null;
});
```

4. Add to props of the `DeckGLOverlay ` and `Map` component

```jsx
  <Map
    ref={mapRef}
    {...cameraFrame}
    style={{width: resolution.width, height: resolution.height}}
    {/* add your props before spreading hubble props */}
    {...mapProps}
  >
    <DeckGLOverlay 
      ref={deckRef} 
      {/* add your props before spreading hubble props */}
      {...deckProps}
    />
  </Map>
```
