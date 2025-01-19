// hubble.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors
/* global window */

import React, {Component, RefObject} from 'react';
import DeckGL, {DeckGLRef} from '@deck.gl/react';
import {MapRef, StaticMap, StaticMapProps} from 'react-map-gl';
import {MapboxOverlay as MapboxLayer} from '@deck.gl/mapbox';
import type {DeckProps, MapViewState} from '@deck.gl/core';
import isEqual from 'lodash.isequal';

import {deckStyle, DeckCanvas} from './styled-components';
import {RenderingSpinner} from './rendering-spinner';
import {createKeplerLayers} from '../../kepler-layers';
import {DeckAdapter} from '@hubble.gl/core';

export type ExportVideoPanelPreviewProps = {
  mapData: any;
  resolution: [number, number];
  exportVideoWidth: number;
  disableStaticMap: boolean;
  deckProps?: DeckProps;
  viewState: MapViewState;
  adapter: DeckAdapter;
  mapboxLayerBeforeId?: string;
  rendering: boolean;
  saving: boolean;
  setViewState: (viewState: MapViewState) => void;
  durationMs: number;
  staticMapProps?: StaticMapProps;
};

type ExportVideoPanelPreviewState = {
  memoDevicePixelRatio: number;
  mapStyle: string;
  mapboxLayerIds?: string[];
  glContext?: WebGLRenderingContext;
};

export class ExportVideoPanelPreview extends Component<
  ExportVideoPanelPreviewProps,
  ExportVideoPanelPreviewState
> {
  mapRef: RefObject<MapRef>;
  deckRef: RefObject<DeckGLRef>;

  constructor(props: ExportVideoPanelPreviewProps) {
    super(props);
    const mapStyle = this.props.mapData.mapStyle;
    const mapStyleUrl = mapStyle.mapStyles[mapStyle.styleType].url;

    this.mapRef = React.createRef<MapRef>();
    this.deckRef = React.createRef<DeckGLRef>();

    this.state = {
      mapStyle: mapStyleUrl, // Unsure if mapStyle would ever change but allowing it just in case
      glContext: undefined,
      memoDevicePixelRatio: window.devicePixelRatio // memoize
    };

    this._onMapLoad = this._onMapLoad.bind(this);
    this._resizeVideo = this._resizeVideo.bind(this);
    this._onAfterRender = this._onAfterRender.bind(this);

    this._resizeVideo();
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(prevProps.resolution, this.props.resolution)) {
      this._resizeVideo();
    }
  }

  componentWillUnmount() {
    const {memoDevicePixelRatio} = this.state;
    this._setDevicePixelRatio(memoDevicePixelRatio);

    if (this.mapRef.current) {
      const map = this.mapRef.current.getMap();

      // remove all rendering related handlers to prevent rendering after unmount
      const listeners = [...map._listeners.render];
      listeners.forEach(listener => {
        map.off('render', listener);
      });

      if (this.state.mapboxLayerIds) {
        this.state.mapboxLayerIds.forEach(id => {
          map.removeLayer(id);
        });
      }
    }
  }

  _resizeVideo() {
    const {exportVideoWidth, resolution, disableStaticMap} = this.props;

    this._setDevicePixelRatio(resolution[0] / exportVideoWidth);

    if (disableStaticMap) {
      return;
    }

    if (this.mapRef.current) {
      const map = this.mapRef.current.getMap();
      map.resize();
    }
  }

  _setDevicePixelRatio(devicePixelRatio: number) {
    /**
     * TODO: This is the only way to trick mapbox into scaling its render buffer up
     * to match the desired resolution. It is built to always fit it's render buffer size
     * to it's CSS container size, which makes it impossible to make a small "preview" box.
     *
     * deck.gl has the useDevicePixels prop, which would have been used if it also changed mapbox.
     * https://github.com/visgl/luma.gl/pull/1155 for background.
     *
     * Compare implementations of luma.gl to mapbox for context:
     * https://github.com/visgl/luma.gl/blob/f622105e30c4dcda434f80ebc4680356003b12fa/modules/gltools/src/utils/device-pixels.js#L31
     * https://github.com/mapbox/mapbox-gl-js/blob/3136a53235cf17b732e84c9945c4e85ba3369a93/src/ui/map.js#L2324
     *
     * In luma the scaler can be overriden by useDevicePixels.
     *
     * The workaround is to change window.devicePixelRatio while the component is mounted to scale up the render buffers of deck and mapbox.
     * This is hacky and can cause issues in certain applications. We should try to produce a better solution.
     */
    // @ts-ignore
    window.devicePixelRatio = devicePixelRatio;
  }

  _getContainer() {
    const {exportVideoWidth, resolution} = this.props;
    const aspectRatio = resolution[0] / resolution[1];
    return {height: exportVideoWidth / aspectRatio, width: exportVideoWidth};
  }

  createLayers() {
    const {deckProps, mapData, viewState} = this.props;
    // returns an arr of DeckGL layer objects
    if (deckProps && deckProps.layers) {
      return deckProps.layers;
    }
    return createKeplerLayers(mapData, viewState);
  }

  _onAfterRender() {
    this.props.adapter.onAfterRender(() => {
      this.forceUpdate();
    }, this.props.disableStaticMap || this.mapRef.current.getMap().areTilesLoaded());
  }

  _onMapLoad() {
    // Adds mapbox layer to modal
    const map = this.mapRef.current.getMap();
    const deck = this.deckRef.current.deck;

    const keplerLayers = this.createLayers();
    const beforeId = this.props.mapboxLayerBeforeId;

    const mapboxLayerIds = [];

    // If there aren't any layers, combine map and deck with a fake layer.
    if (!keplerLayers.length) {
      map.addLayer(new MapboxLayer({id: '%%blank-layer', ...deck}));
      mapboxLayerIds.push('%%blank-layer');
    }

    for (let i = 0; i < keplerLayers.length; i++) {
      // Adds DeckGL layers to Mapbox so Mapbox can be the bottom layer. Removing this clips DeckGL layers
      map.addLayer(new MapboxLayer({id: keplerLayers[i].id, ...deck}), beforeId);
      mapboxLayerIds.push(keplerLayers[i].id);
    }

    this.setState({mapboxLayerIds});

    map.on('render', this._onAfterRender);
  }

  render() {
    const {
      rendering,
      saving,
      viewState,
      setViewState,
      adapter,
      durationMs,
      resolution,
      deckProps,
      staticMapProps,
      disableStaticMap
    } = this.props;
    const {glContext, mapStyle} = this.state;
    const deck = this.deckRef.current && this.deckRef.current.deck;
    const {width, height} = this._getContainer();

    return (
      <>
        <DeckCanvas id="deck-canvas" $width={width} $height={height}>
          <DeckGL
            ref={this.deckRef}
            viewState={viewState}
            id="hubblegl-overlay"
            layers={this.createLayers()}
            style={deckStyle}
            controller={true}
            glOptions={{stencil: true}}
            onWebGLInitialized={gl => this.setState({glContext: gl})}
            onViewStateChange={({viewState: vs}) => setViewState(vs)}
            {...(disableStaticMap ? {onAfterRender: this._onAfterRender} : {})}
            width={resolution[0]}
            height={resolution[1]}
            // onClick={visStateActions.onLayerClick}
            {...adapter.getProps({deck, extraProps: deckProps})}
          >
            {disableStaticMap || !glContext ? null : (
              <StaticMap
                ref={this.mapRef}
                mapStyle={mapStyle}
                preventStyleDiffing={true}
                gl={glContext}
                onLoad={this._onMapLoad}
                {...staticMapProps}
              />
            )}
          </DeckGL>
        </DeckCanvas>
        {rendering && (
          <RenderingSpinner
            rendering={rendering}
            saving={saving}
            width={width}
            height={height}
            adapter={adapter}
            durationMs={durationMs}
          />
        )}
      </>
    );
  }
}
