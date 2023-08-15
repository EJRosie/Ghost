import Service, {inject as service} from '@ember/service';
import fetch from 'fetch';
import {assign} from '@ember/polyfills';
import {isEmpty} from '@ember/utils';
import {or} from '@ember/object/computed';
import {reject, resolve} from 'rsvp';
import {task, taskGroup, timeout} from 'ember-concurrency';

const ALL_CARDS_API = "https://api.scryfall.com/catalog/card-names";
const API_URL = 'https://api.unsplash.com';
const API_VERSION = 'v1';
const DEBOUNCE_MS = 600;

export default Service.extend({
    settings: service(),

    columnCount: 3,
    columns: null,
    error: '',
    photos: null,
    searchTerm: '',

    _columnHeights: null,
    _pagination: null,

    applicationId: '8672af113b0a8573edae3aa3713886265d9bb741d707f6c01a486cde8c278980',
    isLoading: or('_search.isRunning', '_loadingTasks.isRunning'),

    cardNames: [],

    init() {
        this._super(...arguments);
    },

    loadAllCards() {
        let url = `${ALL_CARDS_API}`;
        return this._makeRequest(url).then(res => {
            return res.data;
        });
    },

    loadCardInfo(cardName) {
        let url = `https://api.scryfall.com/cards/named?exact=${cardName}`;
        return this._makeRequest(url);
    },

    _makeRequest(url, _options = {}) {
        let defaultOptions = {ignoreErrors: false};
        let headers = {};
        let options = {};

        assign(options, defaultOptions, _options);

        // clear any previous error
        this.set('error', '');

        // store the url so it can be retried if needed
        this._lastRequestUrl = url;

        return fetch(url, {headers})
            .then(response => this._checkStatus(response))
            .then(response => this._extractPagination(response))
            .then(response => response.json())
    },

    _checkStatus(response) {
        // successful request
        if (response.status >= 200 && response.status < 300) {
            return resolve(response);
        }

        let errorText = '';
        let responseTextPromise = resolve();

        if (response.headers.map['content-type'] === 'application/json') {
            responseTextPromise = response.json().then(json => json.errors[0]);
        } else if (response.headers.map['content-type'] === 'text/xml') {
            responseTextPromise = response.text();
        }

        return responseTextPromise.then((responseText) => {
            if (response.status === 403 && response.headers.map['x-ratelimit-remaining'] === '0') {
                // we've hit the ratelimit on the API
                errorText = 'Unsplash API rate limit reached, please try again later.';
            }

            errorText = errorText || responseText || `Error ${response.status}: Uh-oh! Trouble reaching the Unsplash API`;

            // set error text for display in UI
            this.set('error', errorText);

            // throw error to prevent further processing
            let error = new Error(errorText);
            error.response = response;
            throw error;
        });
    },

    _extractPagination(response) {
        let pagination = {};
        let linkRegex = new RegExp('<(.*)>; rel="(.*)"');
        let {link: links} = response.headers.map;

        if (links) {
            links.split(',').forEach((link) => {
                let [, url, rel] = linkRegex.exec(link);

                pagination[rel] = url;
            });
        }

        this._pagination = pagination;

        return response;
    }
});
