const path = require('path');
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const config = require('../../shared/config');
const storage = require('../adapters/storage');

let cardFactory;
let cards;
let mobiledocHtmlRenderer;

const DECKLIST_CATEGORIES_MAP = [
    { key: "lands", label: "Lands"},
    { key: "creatures", label: "Creatures"},
    { key: "spells", label: "Instants & Sorceries"},
    { key: "artifacts", label: "Artifacts"},
    { key: "enchantments", label: "Enchantments"},
    { key: "planeswalkers", label: "Planeswalkers"},
    { key: "other", label: "Other"},
    { key: "sideboard", label: "Sideboard"}
  ]


module.exports = {
    get blankDocument() {
        return {
            version: '0.3.1',
            ghostVersion: '4.0',
            markups: [],
            atoms: [],
            cards: [],
            sections: [
                [1, 'p', [
                    [0, [], 0, '']
                ]]
            ]
        };
    },

    get cards() {
        if (!cards) {
            const CardFactory = require('@tryghost/kg-card-factory');
            const defaultCards = require('@tryghost/kg-default-cards');

            cardFactory = new CardFactory({
                siteUrl: config.get('url'),
                imageOptimization: config.get('imageOptimization'),
                canTransformImage(storagePath) {
                    const imageTransform = require('@tryghost/image-transform');
                    const {ext} = path.parse(storagePath);

                    // NOTE: the "saveRaw" check is smelly
                    return imageTransform.canTransformFiles()
                        && imageTransform.shouldResizeFileExtension(ext)
                        && typeof storage.getStorage('images').saveRaw === 'function';
                }
            });

            cards = defaultCards.map((card) => {
                return cardFactory.createCard(card);
            });
        }

        return cards;
    },

    get atoms() {
        return require('@tryghost/kg-default-atoms');
    },

    get mobiledocHtmlRenderer() {
        if (!mobiledocHtmlRenderer) {
            const MobiledocHtmlRenderer = require('@tryghost/kg-mobiledoc-html-renderer');

            mobiledocHtmlRenderer = new MobiledocHtmlRenderer({
                cards: this.cards,
                atoms: this.atoms,
                unknownCardHandler(args) {
                    if (args.env.name === "decklist") {
                        var dom = args.env.dom;
                        var payload = args.payload;

                        var container = args.env.dom.createElement('figure');
                        container.setAttribute( "class", "tlk-decklist");

                        if (payload.decklistPlayerName?.length > 0 || payload.decklistName?.length > 0) {
                            const header = dom.createElement('div');
                            header.setAttribute("class", "tlk-decklist-header");
                            const title = dom.createElement('h3');
                            title.appendChild(dom.createTextNode(payload.decklistName));
                            header.appendChild(title);
                            if (payload.decklistPlayerName?.length > 0) {
                                const player = dom.createElement('h3');
                                player.appendChild(dom.createTextNode(`By ${payload.decklistPlayerName}`));
                                header.appendChild(player);
                            }
                            container.appendChild(header);
                        }

                        const decklist = dom.createElement('div');
                        decklist.setAttribute("class", "tlk-decklist-list");

                        const decklistCategories = DECKLIST_CATEGORIES_MAP.map((cat) => {
                            if (cat.key in payload.decklist && Object.keys(payload.decklist[cat.key]).length > 0) {
                                const title = dom.createElement('h3');
                                title.appendChild(dom.createTextNode(cat.label));
                                decklist.appendChild(title);
                                Object.entries(payload.decklist[cat.key]).forEach(([cardname, count]) => {
                                const cardElement = dom.createElement('p');
                                    cardElement.appendChild(dom.createTextNode(count + "x"));
                                    cardElement.appendChild(dom.createTextNode(`[[${cardname}]]`));
                                    decklist.appendChild(cardElement);
                                });
                            }
                        });
                        container.appendChild(decklist);
                        return container;
                    }
                    logging.error(new errors.InternalServerError({
                        message: 'Mobiledoc card \'' + args.env.name + '\' not found.'
                    }));
                }
            });
        }

        return mobiledocHtmlRenderer;
    },

    get htmlToMobiledocConverter() {
        try {
            return require('@tryghost/html-to-mobiledoc').toMobiledoc;
        } catch (err) {
            return () => {
                throw new errors.InternalServerError({
                    message: 'Unable to convert from source HTML to Mobiledoc',
                    context: 'The html-to-mobiledoc package was not installed',
                    help: 'Please review any errors from the install process by checking the Ghost logs',
                    code: 'HTML_TO_MOBILEDOC_INSTALLATION',
                    err: err
                });
            };
        }
    },

    // used when force-rerendering post content to ensure that old image card
    // payloads contain width/height values to be used when generating srcsets
    populateImageSizes: async function (mobiledocJson) {
        // do not require image-size until it's requested to avoid circular dependencies
        // shared/url-utils > server/lib/mobiledoc > server/lib/image/image-size > server/adapters/storage/utils
        const {imageSize} = require('./image');

        async function getUnsplashSize(url) {
            const parsedUrl = new URL(url);
            parsedUrl.searchParams.delete('w');
            parsedUrl.searchParams.delete('fit');
            parsedUrl.searchParams.delete('crop');
            parsedUrl.searchParams.delete('dpr');

            return await imageSize.getImageSizeFromUrl(parsedUrl.href);
        }

        const mobiledoc = JSON.parse(mobiledocJson);

        const sizePromises = mobiledoc.cards.map(async (card) => {
            const [cardName, payload] = card;

            const needsFilling = cardName === 'image' && payload && payload.src && (!payload.width || !payload.height);
            if (!needsFilling) {
                return;
            }

            const isUnsplash = payload.src.match(/images\.unsplash\.com/);
            try {
                const size = isUnsplash ? await getUnsplashSize(payload.src) : await imageSize.getOriginalImageSizeFromStorageUrl(payload.src);

                if (size && size.width && size.height) {
                    payload.width = size.width;
                    payload.height = size.height;
                }
            } catch (e) {
                // TODO: use debug instead?
                logging.error(e);
            }
        });

        await Promise.all(sizePromises);

        return JSON.stringify(mobiledoc);
    },

    // allow config changes to be picked up - useful in tests
    reload() {
        cardFactory = null;
        cards = null;
        mobiledocHtmlRenderer = null;
    }
};
