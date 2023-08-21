import Component from '@glimmer/component';
import {action} from '@ember/object';
import {inject} from 'ghost-admin/decorators/inject';
import {isBlank} from '@ember/utils';
import {run} from '@ember/runloop';
import {inject as service} from '@ember/service';
import {set} from '@ember/object';
import {tracked} from '@glimmer/tracking';


export default class tlkDecklistComponent extends Component {
    @service scryfall;
    @service feature;
    @service store;
    @service membersUtils;
    @service ui;

    @inject config;

    @tracked zoomedPhoto = null;
    @tracked isSearching = null;
    @tracked shownCards = null;
    @tracked allCards = null;
    @tracked searchTerm = null;

    @tracked sideboardSwitch = false;

    @action
    toggleSideboardSwitch() {
        this.sideboardSwitch = !this.sideboardSwitch;
    }

    @tracked decklist_categories = [
        { key: "creatures", label: "Creatures"},
        { key: "lands", label: "Lands"},
        { key: "spells", label: "Instants & Sorceries"},
        { key: "artifacts", label: "Artifacts"},
        { key: "enchantments", label: "Enchantments"},
        { key: "planeswalkers", label: "Planeswalkers"},
        { key: "other", label: "Other"},
        { key: "sideboard", label: "Sideboard"}
    ]

    @tracked decklistForHandlebars = [];

    get decklist() {
        return this.args.payload.decklist
    }
    

    get isEmpty() {
        const {creatures, lands, planeswalkers, artifacts, enchantments, spells, other, sideboard} = this.args.payload.decklist;

        return isBlank(creatures) && isBlank(lands) && isBlank(planeswalkers) && isBlank(artifacts) && isBlank(enchantments) && isBlank(spells) && isBlank(other) && isBlank(sideboard);
    }

    // Toolbar for the top of the card when first clicked, second click will edit
    get toolbar() {
        if (this.args.isEditing) {
            return false;
        }

        return {
            items: [{
                buttonClass: 'fw4 flex items-center white',
                icon: 'koenig/kg-edit',
                iconClass: 'fill-white',
                title: 'Edit',
                text: '',
                action: run.bind(this, this.args.editCard)
            }]
        };
    }

    constructor() {
        super(...arguments);
        this.args.registerComponent(this);

        const payloadDefaults = {
            decklist: {
                creatures: {},
                lands: {},
                spells: {},
                artifacts: {},
                enchantments: {},
                planeswalkers: {},
                other: {},
                sideboard: {}
            },
            decklistName: "Decklist"
        };
        Object.entries(payloadDefaults).forEach(([key, value]) => {
            if (this.args.payload[key] === undefined) {
                this._updatePayloadAttr(key, value);
            }
        });
        
        key.setScope('scryfall');
        var res = this.scryfall.loadAllCards().then(res => {
            this.allCards = res;
            this.shownCards = [];
            return res;
        });
        this.decklistName = "Decklist";
        this.recompileDecklistForHandlebars();
    }



    recompileDecklistForHandlebars() {
        this.decklistForHandlebars = [];
        this.decklistForHandlebars = [
            ...[ this.decklist?.lands && Object.keys(this.decklist.lands).length > 0 ? { key: "lands", label: "Lands", cards: this.compileCardList(this.decklist.lands)} : {}],
            ...[ this.decklist?.creatures && Object.keys(this.decklist.creatures).length > 0 ? { key: "creatures", label: "Creatures", cards: this.compileCardList(this.decklist.creatures)} : {}],
            ...[ this.decklist?.spells && Object.keys(this.decklist.spells).length > 0 ? { key: "spells", label: "Instants & Sorceries", cards: this.compileCardList(this.decklist.spells)} : {}],
            ...[ this.decklist?.artifacts && Object.keys(this.decklist.artifacts).length > 0 ? { key: "artifacts", label: "Artifacts", cards: this.compileCardList(this.decklist.artifacts)} : {}],
            ...[ this.decklist?.enchantments && Object.keys(this.decklist.enchantments).length > 0 ? { key: "enchantments", label: "Enchantments", cards: this.compileCardList(this.decklist.enchantments)} : {}],
            ...[ this.decklist?.planeswalkers && Object.keys(this.decklist.planeswalkers).length > 0 ? { key: "planeswalkers", label: "Planeswalkers", cards: this.compileCardList(this.decklist.planeswalkers)} : {}],
            ...[ this.decklist?.other && Object.keys(this.decklist.other).length > 0 ? { key: "other", label: "Other", cards: this.compileCardList(this.decklist.other)} : {}],
            ...[ this.decklist?.sideboard && Object.keys(this.decklist.sideboard).length > 0 ? { key: "sideboard", label: "Sideboard", cards: this.compileCardList(this.decklist.sideboard)} : {}]
        ]
    }

    compileCardList(cardList) {
        var list = Object.keys(cardList).map((cardname) => {
            return {
                name: cardname,
                count: cardList[cardname]
            }
        }).sort((a,b) => {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
        });
        return list;
    }

    // required for snippet rects to be calculated - editor reaches in to component,
    // expecting a non-Glimmer component with a .element property
    @action
    registerElement(element) {
        this.element = element;
    }

    @action
    setDecklistTitle(event) {
        event.preventDefault();
        const name = event.target.value;
        this._updatePayloadAttr('decklistName', name);
        this.decklistName = name;
    }

    // Searching & Adding Actions
    @action
    search(event) {
        event.preventDefault();
        const term = event.target.value;
        const filter = this.allCards.filter((name) => name.toLowerCase().includes(term.toLowerCase()));
        const filterWithPerfectOnTop = filter.sort((a,b) => {
            if (a.toLowerCase() === term.toLowerCase()) {
                return -1;
            }
            return a - b;
        }).slice(0,20);
        this.shownCards = filterWithPerfectOnTop;
        this.isSearching = true;
        this.searchTerm = term;
    }

    @action
    clearSearch() {
        this.shownCards = [];
        this.isSearching = false;
        this.searchTerm = null;
    }

    @action
    addCardToDeck(card) {
        if (!card) {
            if (this.shownCards && this.shownCards.length > 0) {
                card = this.shownCards[0];
            }
            else {
                return;
            }
        }
        this.clearSearch();
        const cardInfo = this.scryfall.loadCardInfo(card).then(res => {
            this.processCard(card, res.type_line.toLowerCase());
        });
    }

    @action
    processCard(cardname, typeline) {
        if(this.sideboardSwitch) {
            return this.addCard(cardname, "sideboard");
        }
        if (typeline.includes("battle")) { 
            this.addCard(cardname, "other");
        }
        else if(typeline.includes("creature")) { 
            this.addCard(cardname, "creatures");
        }
        else if(typeline.includes("land")) { 
            this.addCard(cardname, "lands");
        }
        else if(typeline.includes("planeswalker")) { 
            this.addCard(cardname, "planeswalkers");
        }
        else if(typeline.includes("artifact")) { 
            this.addCard(cardname, "artifacts");
        }
        else if(typeline.includes("enchantment")) { 
            this.addCard(cardname, "enchantments");
        }
        else if(typeline.includes("instant") || typeline.includes("sorcery")) { 
            this.addCard(cardname, "spells");
        }
        else {
            this.addCard(cardname, "other");
        }
    }

    @action
    addCard(cardname, type) {
        const newDecklist = {...this.decklist}
        if (newDecklist[type] === undefined) {
            newDecklist[type] = {};
        }
        newDecklist[type][cardname] = 1;
        this._updatePayloadAttr('decklist', newDecklist);
        this.recompileDecklistForHandlebars();
    }

    @action
    removeCount(cardname, type, fullRemove=false) {
        const newDecklist = {...this.decklist}
        newDecklist[type][cardname] -= 1;
        if (newDecklist[type][cardname] <= 0 || fullRemove) {
            delete newDecklist[type][cardname];
        }
        this._updatePayloadAttr('decklist', newDecklist);
        this.recompileDecklistForHandlebars();
    }
    @action
    addCount(cardname, type) {
        const newDecklist = {...this.decklist}
        newDecklist[type][cardname] += 1;
        this._updatePayloadAttr('decklist', newDecklist);
        this.recompileDecklistForHandlebars();
    }

    @action
    leaveEditMode() {
        if (this.isEmpty) {
            // afterRender is required to avoid double modification of `isSelected`
            // TODO: see if there's a way to avoid afterRender
            run.scheduleOnce('afterRender', this, this.args.deleteCard);
        }
    }
    

    _updatePayloadAttr(attr, value) {          
        let payload = this.args.payload;

        set(payload, attr, value);

        // update the mobiledoc and stay in edit mode
        this.args.saveCard?.(payload, false);
    }

    _afterRender() {
        this._placeCursorAtEnd();
        this._focusInput();
    }

    _placeCursorAtEnd() {
        if (!this._textReplacementEditor) {
            return;
        }

        let tailPosition = this._textReplacementEditor.post.tailPosition();
        let rangeToSelect = tailPosition.toRange();
        this._textReplacementEditor.selectRange(rangeToSelect);
    }

    _focusInput() {
        let headingInput = this.element.querySelector('.kg-product-card-title .koenig-basic-html-input__editor');

        if (headingInput) {
            headingInput.focus();
        }
    }
}


/*
creatures: {
                    "Brazen Borrower": 1,
                    "Fury": 2,
                    "Shardless Agent": 4,
                    "Subtlety": 3
                },
                lands: {
                    "Boseiju, Who Endures": 1,
                    "Breeding Pool": 1,
                    "Flooded Strand": 4,
                    "Forest": 1,
                    "Hallowed Fountain": 1,
                    "Island": 1,
                    "Misty Rainforest": 4,
                    "Otawara, Soaring City": 1,
                    "Steam Vents": 1,
                    "Stomping Ground": 1,
                    "Temple Garden": 1,
                    "Wooded Foothills": 4,
                    "Xander's Lounge": 1
                },   
                enchantments: {
                    "Ardent Plea": 1,
                    "Leyline Binding": 4
                },
                spells: {
                    "Crashing Footfalls": 4,
                    "Dead / Gone": 1,
                    "Fire / Ice": 4,
                    "Force of Negation": 4,
                    "Lórien Revealed": 4,
                    "Mystical Dispute": 2,
                    "Violent Outburst": 4
                }
*/