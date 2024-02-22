// Reactive components styling (for some reason using media-queries in monopoly.css does not work)
export function reactiveStyles(game) {
  if(window.innerWidth > 768) {
    // For desktop
    return {
      welcomeText: {
        marginTop: `0.5em`
      },
      initialFundingButton: {
        marginLeft: `2em`
      },
      inviteButton: {
        marginLeft: `2em`
      },
      cardsStack: {
        height: `35em`,
        marginLeft: '11.5em'
      },
      cardImage: {
        height: `20em`
      },
      card: (card) => {
        let cardPosition;
        game.properties[game.player.wallets[0].id][card.color].forEach((_card) => {
          if(_card.id === card.id) {
            cardPosition = _card.position;
          }
        });
        let marginTopFactor = 3;
        let marginTop = game.properties[game.player.wallets[0].id][card.color].length === 1 ? (marginTopFactor * 2).toString() + `em` : (marginTopFactor * (parseInt(cardPosition) + 1)).toString() + `em`;
        let marginLeft = game.properties[game.player.wallets[0].id][card.color].length === 1 ? 0 : ((-1)**(parseInt(cardPosition) + 1)).toString() + `em`;
        return({
          position: `absolute`,
          zIndex: parseInt(cardPosition) + 2,
          marginTop,
          marginLeft
        })
      },
      lightningCard: (lightningCard) => {
        if(lightningCard.fineType) {
          return({
            height: `auto`,
            maxWidth: `65%`,
            marginTop: `1em`,
            marginLeft: `2em`
          })
        } else  {
          return({
            height: `auto`,
            maxWidth: `100%`,
            marginTop: `1em`,
            marginLeft: `6em`
          })
        }
      },
      protocolCard: (protocolCard) => {
        if(protocolCard.fineType) {
          return({
            height: `auto`,
            maxWidth: `85%`,
            marginTop: `1em`,
            marginLeft: `2em`
          })
        } else if (protocolCard.rewardType) {
          return({
              height: `auto`,
              maxWidth: `85%`,
              marginTop: `1em`,
              marginLeft: `2em`
          })
        } else  {
          return({
            height: `auto`,
            maxWidth: `100%`,
            marginTop: `1em`,
            marginLeft: `6em`
          })
        }
      },
      cardsMessage: {
        marginTop: `1em`
      },
      cardsAmountForm: {
        marginTop: `1em`,
        marginLeft: `-2em`
      },
      cardsAmount: {
        marginTop: `1em`,
      },
      cardsButton: {
        marginTop: `2em`,
        marginLeft: `0em`
      },
      protocolCardImage: {
        height: `auto`,
        maxWidth: `65%`,
        marginTop: `1em`,
        marginLeft: `2em`
      },
      payInvoiceLabel: {
        marginTop: `1em`,
        marginLeft: `1em`
      },
      payInvoiceButton: {
        marginLeft: `1em`
      },
      networkFeeMessage: {
        marginTop: `0em`,
      },
      networkFeeAmountForm: {
        marginTop: `1em`,
      },
      networkFeeAmount: {
        marginLeft: `0em`
      },
      propertyImage: {
        height: `auto`,
        maxWidth: `65%`,
        marginTop: `1em`,
        marginLeft: `2em`
      },
      propertyOwnershipLabel: {
        marginTop: `1em`
      },
      propertyMiningCapacityLabel: {
        marginTop: `1em`
      },
      propertyMiningIncomeLabel: {
        marginTop: `1em`
      },
      propertyButtons: {
        cardButtonsGroup: {
          marginTop: `2em`
        },
        bottomButtonsGroup: {
          marginTop: `1em`
        },
        buyButton: {
          marginTop: `2.5em`,
          marginLeft: `-1em`
        },
        invoiceButton: {
          marginTop: `2em`,
          marginLeft: `-0.25em`
        },
        upgradeButton: {
          marginLeft: `-1em`
        },
        sellButton: {
          marginLeft: `0em`
        },
        offerButton: {
          marginTop: `2.5em`,
          marginLeft: `-1em`
        },
      },
      propertyCloseButton: {
        marginTop: `1em`
      },
      propertyButtonsForGameCreator: {
        div: {
          marginTop: `1em`
        },
        invoicePurchaseButton: {
          marginLeft: `0em`
        },
        invoiceUpgradeButton: {
          marginLeft: `0em`
        },
      },
      cameraFocusSlider: {
        marginLeft: `5em`,
        marginTop: `3em`
      },
    }
  } else {
    return {
      welcomeText: {
        marginTop: `1.5em`
      },
      initialFundingButton: {
        marginLeft: `-1em`
      },
      inviteButton: {
        marginLeft: `-1em`
      },
      cardsStack: {
        height: `36em`,
        marginLeft: '0.7em',
        marginTop: '-4.5em',
        marginBottom: '3em'
      },
      cardImage: {
        height: `21em`
      },
      card: (card) => {
        let cardPosition;
        game.properties[game.player.wallets[0].id][card.color].forEach((_card) => {
          if(_card.id === card.id) {
            cardPosition = _card.position;
          }
        });
        let marginTopFactor = 5.6;
        let marginTop = game.properties[game.player.wallets[0].id][card.color].length == 1 ? (marginTopFactor * 2).toString() + `em` : (marginTopFactor * (parseInt(cardPosition) + 1)).toString() + `em`;
        let marginLeft = game.properties[game.player.wallets[0].id][card.color].length == 1 ? 0 : ((-1)**(parseInt(cardPosition) + 1)).toString() + `em`;
        return({
          position: `absolute`,
          zIndex: parseInt(cardPosition) + 2,
          marginTop,
          marginLeft
        })
      },
      lightningCard: (lightningCard) => {
        if(lightningCard.fineType) {
          return {
            height: `auto`,
            maxWidth: `100%`,
            marginTop: `0.5em`,
            marginLeft: `0em`
          }
        } else  {
          return {
            height: `auto`,
            maxWidth: `150%`,
            marginTop: `0.5em`,
            marginLeft: `1.5em`
          }
        }
      },
      protocolCard: (protocolCard) => {
        if(protocolCard.fineType) {
          return({
            height: `auto`,
            maxWidth: `100%`,
            marginTop: `0.5em`,
            marginLeft: `0em`
          })
        } else if (protocolCard.rewardType) {
          return({
            height: `auto`,
            maxWidth: `100%`,
            marginTop: `0.5em`,
            marginLeft: `0em`
          })
        } else  {
          return({
            height: `auto`,
            maxWidth: `150%`,
            marginTop: `0.5em`,
            marginLeft: `1.5em`
          })
        }
      },
      cardsMessage: {
        marginTop: `1em`,
        marginLeft: `2em`
      },
      cardsAmountForm: {
        marginTop: `1em`,
        marginLeft: `1em`
      },
      cardsAmount: {
        marginTop: `1em`,
        marginLeft: `2em`
      },
      cardsButton: {
        marginLeft: `0em`
      },
      protocolCardImage: {
        height: `auto`,
        maxWidth: `85%`,
        marginTop: `0.5em`,
        marginLeft: `0em`
      },
      payInvoiceLabel: {
        marginTop: `1em`,
        marginLeft: `1em`
      },
      payInvoiceButton: {
        marginLeft: `1em`
      },
      networkFeeMessage: {
        marginTop: `-1em`,
        marginLeft: `-1em`
      },
      networkFeeAmountForm: {
        marginTop: `0em`,
        marginBottom: `1em`,
        marginLeft: `-2em`
      },
      networkFeeAmount: {
        marginTop: `-1em`,
        marginLeft: `-2em`
      },
      propertyImage: {
        height: `auto`,
        maxWidth: `85%`,
        marginTop: `0.5em`,
        marginLeft: `0em`
      },
      propertyOwnershipLabel: {
        marginTop: `1em`,
        marginLeft: `-1em`
      },
      propertyMiningCapacityLabel: {
        marginTop: `1em`,
        marginLeft: `-1em`
      },
      propertyMiningIncomeLabel: {
        marginTop: `1em`,
        marginLeft: `-1em`
      },
      propertyButtons: {
        cardButtonsGroup: {
          marginTop: `2em`
        },
        bottomButtonsGroup: {
          marginTop: `1em`
        },
        buyButton: {
          marginTop: `1em`,
          marginLeft: `-2em`
        },
        invoiceButton: {
          marginLeft: `-1em`
        },
        upgradeButton: {
          marginLeft: `-2em`
        },
        sellButton: {
          marginLeft: `0em`
        },
        offerButton: {
          marginTop: `1em`,
          marginLeft: `-2em`
        },
      },
      propertyCloseButton: {
        marginTop: `1em`
      },
      propertyButtonsForGameCreator: {
        div: {
          marginTop: `1em`
        },
        invoicePurchaseButton: {
          marginLeft: `0em`
        },
        invoiceUpgradeButton: {
          marginLeft: `0em`
        },
      },
      cameraFocusSlider: {
        marginLeft: `5em`,
        marginTop: `3em`
      },
    }
  }
}
