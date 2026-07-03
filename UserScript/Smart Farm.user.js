// ==UserScript==
// @name         Smart Farm
// @version      2.0
// @description  Smart farm script for better farming
// @match        https://*.tribalwars.com.pt/*screen=am_farm*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tribalwars.com.br
// @downloadURL  https://raw.githubusercontent.com/wasdfra/TWScripts/master/UserScript/Smart%20Farm.user.js
// @updateURL    https://github.com/wasdfra/TWScripts/raw/master/UserScript/Smart%20Farm.user.js
// @run-at document-end
// @run-at document-idle
// ==/UserScript==

// Should skip villages with wall?
// true = yes
// false = no
const SKIP_WALL = false;

(function () {
  'use strict';

  const SmartFarm = new function () {
    const TemplatesEnum = {
      A: 'a',
      B: 'b',
      C: 'c'
    }

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    const randomTime = (min, max) => {
      return Math.round(min + Math.random() * (max - min));
    };

    const getTemplates = () => {
      return Accountmanager.farm.templates;
    };

    const getCurrentUnits = () => {
      return Accountmanager.farm.current_units;
    };

    const getNextVillage = () => {
      // query only rows that are visible!
      return document.querySelector(
        "tr[id^='village_']:not([style='display: none;'])"
      );
    };

    const hasLootedAll = (villageElement) => {
      const lastLoot = villageElement.querySelector("img[src*='max_loot']");
      return lastLoot && lastLoot.getAttribute("src").endsWith("1.webp");
    };

    const hasEnoughUnitsInTemplate = (template) => {
      const units = getCurrentUnits();

      for (const unitName in units) {
        if (units.hasOwnProperty(unitName)) {
          const unitQuantity = units[unitName];
          const templateUnitQuantity = template[unitName];

          if (templateUnitQuantity && unitQuantity < templateUnitQuantity) {
            return false;
          }
        }
      }

      return true;
    };

    const getWallLevel = (villageElement) => {
      return parseInt((villageElement.querySelectorAll("td")[6]).innerHTML);
    }

    const validateWall = (villageElement, toHide) => {
      const wallLevel = getWallLevel(villageElement)
      if (wallLevel !== NaN && wallLevel > 0) {
         if(toHide)
             villageElement.style.display = 'none';

        return true
      }

      return false
    }

    const clickTemplate = (templateType, villageElement) => {
      const selector = `a.farm_icon.farm_icon_${templateType}`;
      const templateLink = villageElement.querySelector(selector);

      if (templateLink) {
        templateLink.click();
      }
    };

    const validateAndSendTemplate = (template, villageElement, templateType) => {
      if ( templateType === 'c' || hasEnoughUnitsInTemplate(template)) {
        clickTemplate(templateType, villageElement);
        return true;
      }
      return false;
    };

    const reloadPage = () => {
      const reloadTime = randomTime(240000, 420000);
      console.log(`will reload in ${reloadTime / 1000} seconds`);
      setTimeout(() => {
        console.log("reloading...");
        window.location.reload();
      }, reloadTime);
    };

    const sendAttack = async () => {

      const templates = getTemplates();
      if (!templates) return;

      const [templateA, templateB] = Object.values(templates);
      const villageElement = getNextVillage();


      if (villageElement) {
          if (SKIP_WALL) {
              const result = validateWall(villageElement, true)
              if (result)
                  return;
          }

          var wallLevel = getWallLevel(villageElement);

          if(wallLevel > 0){
              if( wallLevel== 1){
                  validateAndSendTemplate(templateB, villageElement, TemplatesEnum.B)
              }
              return;
          }

          if (hasLootedAll(villageElement)) {
              if (!validateAndSendTemplate(templateA, villageElement, TemplatesEnum.C)) {
                  validateAndSendTemplate(templateA, villageElement, TemplatesEnum.A);
              }
          } else {
              validateAndSendTemplate(templateA, villageElement, TemplatesEnum.A);
          }

        const waitTime = randomTime(250, 350);
        await delay(waitTime);
      }
    };


    this.init = async () => {
        await setInterval(5000);
      console.log("starting farm");

      // start the page reload
      reloadPage();

      setInterval(async () => {
        await sendAttack();
      }, 500)
    };

  };

  $(function () {
    setInterval( () => {
        if (typeof Accountmanager !== 'undefined' && Accountmanager.farm) {
            Accountmanager.farm.init();
            SmartFarm.init();
        } else {
            console.error('Accountmanager or farm not defined');
        }
    },5000);
  });
})();
