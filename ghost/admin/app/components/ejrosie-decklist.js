/* global key */
import Component from '@glimmer/component';
import {action} from '@ember/object';
import {inject as service} from '@ember/service';
import {tracked} from '@glimmer/tracking';

const ONE_COLUMN_WIDTH = 540;
const TWO_COLUMN_WIDTH = 940;

export default class EJRosieDecklist extends Component {
    @service scryfall;
    @service ui;

    @tracked zoomedPhoto = null;
    @tracked isSearching = null;
    @tracked shownCards = null;
    @tracked allCards = null;

    sideboardSwitch = false;

    @tracked decklist = {
        creatures: [],
        lands: [],
        planeswalkers: [],
        artifacts: [],
        enchantments: [],
        spells: [],
        other: [],
        sideboard: []
    };
    

    get sideNavHidden() {
        return this.ui.isFullScreen || this.ui.showMobileMenu;
    }

    constructor() {
        super(...arguments);
        key.setScope('scryfall');
        var res = this.scryfall.loadAllCards().then(res => {
            this.allCards = res;
            this.shownCards = [];
            return res;
        });
        
    }

    willDestroy() {
        super.willDestroy(...arguments);
        key.setScope('default');
    }

    @action
    processCard(cardname, typeline) {
        console.log("Processing Card...");
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
        console.log(`Adding ${cardname} to ${type}`);
        this.decklist[type].push({
            name: cardname,
            count: 1
        });
        this.decklist = this.decklist;
    }

    @action
    search(event) {
        event.preventDefault();
        const term = event.target.value;
        const filter = this.allCards.filter((name) => name.toLowerCase().includes(term.toLowerCase())).slice(0,20);
        this.shownCards = filter;
        this.isSearching = true;
    }

    @action
    clearSearch() {
        this.shownCards = [];
        this.isSearching = false;
    }

    @action
    selectCard(card) {
        this.clearSearch();
        const cardInfo = this.scryfall.loadCardInfo(card).then(res => {
            this.processCard(card, res.type_line.toLowerCase());
        });
    }

    @action
    handleEscape(event) {
        event?.preventDefault();
        this.args.close();
    }

    @action
    handleResize(element) {
        return;
    }
}
