// Reactive components styling (for some reason using media-queries in play.css does not work)
export function reactiveStyles(game) {
  if(window.innerWidth > 768) {
    // For desktop
    return {
      welcomeText: {
        marginTop: `0.5em`
      },
      newGameButton: {
        marginLeft: `30em`
      },
      initialFundingButton: {
        marginLeft: `2em`
      },
      inviteButton: {
        marginLeft: `2em`
      },
      header: (showWarningMessage) => {
        if(showWarningMessage) {
          return(
            {
              marginTop: `-9em`
            }
          )
        } else {
          return(
            {
              marginTop: `-5em`
            }
          )
        }
      },
      playerName: {
        paddingTop: `0.5em`,
        fontSize: `2.5em`
      },
      gameButtonsGroup: {
        paddingTop: `0em`
      },
      nextPlayerTurnButton: {
        padding: `0.5em`
      },
      receiveButton: {
        padding: `0.5em`,
        marginLeft: `2em`
      },
      sendButton: {
        padding: `0.5em`,
        marginLeft: `2em`
      },
      fundingViewContainer: {
        marginTop: `1em`,
        paddingRight: `0.5em`
      },
      propertiesContainer: {
        marginTop: `1em`,
        paddingRight: `0.5em`
      },
      playersTableContainer: {
        marginTop: `1em`,
        paddingLeft: `0.5em`
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
        Object.keys(game.properties[game.player.index][card.color]).forEach((key) => {
          if(game.properties[game.player.index][card.color][key].property_id === card.property_id) {
            cardPosition = game.properties[game.player.index][card.color][key].position;
          }
        });
        let marginTopFactor = 3;
        let marginTop = Object.keys(game.properties[game.player.index][card.color]).length === 1 ? (marginTopFactor * 2).toString() + `em` : (marginTopFactor * (parseInt(cardPosition) + 1)).toString() + `em`;
        let marginLeft = Object.keys(game.properties[game.player.index][card.color]).length === 1 ? 0 : ((-1)**(parseInt(cardPosition) + 1)).toString() + `em`;
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
      cardsSpinner: {
        marginTop: `2.5em`,
        marginLeft: `2em`
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
      payInvoiceSpinner: {
        marginTop: `2.5em`,
        marginLeft: `2em`
      },
      payPropertyInvoiceSpinner: {
        marginTop: `2.5em`,
        marginLeft: `2em`
      },
      upgradePropertyInvoiceSpinner: {
        marginTop: `2.5em`,
        marginLeft: `2em`
      },
      payNetworkFeeInvoiceSpinner: {
        marginTop: `2.5em`,
        marginLeft: `2em`
      },
      payWrenchAttackSpinner: {
        marginTop: `2.5em`,
        marginLeft: `2em`
      },
      inviteSpinner: {
        marginLeft: `0.8em`,
        marginRight: `0.8em`
      },
      loadingSpinner: {
        marginTop: `4em`,
        marginLeft: `7em`,
      },
      cameraDeviceIcon: {
        marginTop: '-1.85em'
      },
      cameraDeviceIndex: {
        marginTop: '-2.2em'
      },
      switchCameraButton: {
        marginTop: '-2em'
      },
      scanButton: {
        marginLeft: `4.7em`
      },
      closGameWarningButton: {
        marginLeft: `10em`
      }
    }
  } else {
    return {
      welcomeText: {
        marginTop: `1.5em`
      },
      newGameButton: {
        marginTop: `1em`,
        marginLeft: `1.5em`
      },
      initialFundingButton: {
        marginLeft: `-1em`
      },
      inviteButton: {
        marginLeft: `-1em`
      },
      header: (showWarningMessage) => {
        if(showWarningMessage) {
          return(
            {
              marginTop: `-14em`
            }
          )
        } else {
          return(
            {
              marginTop: `-9em`
            }
          )
        }
      },
      playerName: {
        paddingTop: `0.7em`,
        fontSize: `1.5em`
      },
      gameButtonsGroup: {
        paddingTop: `1em`
      },
      nextPlayerTurnButton: {
        padding: `0.5em`
      },
      receiveButton: {
        padding: `0.5em`,
        marginLeft: `1em`
      },
      sendButton: {
        padding: `0.5em`,
        marginLeft: `1em`
      },
      fundingViewContainer: {
        marginTop: `-2em`,
        paddingRight: `0em`
      },
      propertiesContainer: {
        marginTop: `1em`,
        paddingRight: `0em`
      },
      playersTableContainer: {
        marginTop: `1em`,
        paddingLeft: `0em`
      },
      cardsStack: {
        height: `36em`,
        marginLeft: '-0.5em',
        marginTop: '-4.5em',
        marginBottom: '3em'
      },
      cardImage: {
        height: `21em`
      },
      card: (card) => {
        let cardPosition;
        Object.keys(game.properties[game.player.index][card.color]).forEach((key) => {
          if(game.properties[game.player.index][card.color][key].property_id === card.property_id) {
            cardPosition = game.properties[game.player.index][card.color][key].position;
          }
        });
        let marginTopFactor = 5.6;
        let marginTop = Object.keys(game.properties[game.player.index][card.color]).length === 1 ? (marginTopFactor * 2).toString() + `em` : (marginTopFactor * (parseInt(cardPosition) + 1)).toString() + `em`;
        let marginLeft = Object.keys(game.properties[game.player.index][card.color]).length === 1 ? 0 : (0.5*((-1)**(parseInt(cardPosition) + 1))).toString() + `em`;
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
      cardsSpinner: {
        marginTop: `0.5em`,
        marginLeft: `1em`
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
      payInvoiceSpinner: {
        marginTop: `0.5em`,
        marginLeft: `1em`
      },
      payPropertyInvoiceSpinner: {
        marginTop: `0.5em`,
        marginLeft: `1em`
      },
      upgradePropertyInvoiceSpinner: {
        marginTop: `0.5em`,
        marginLeft: `1em`
      },
      payNetworkFeeInvoiceSpinner: {
        marginTop: `0.5em`,
        marginLeft: `1em`
      },
      payWrenchAttackSpinner: {
        marginTop: `0.5em`,
        marginLeft: `1em`
      },
      inviteSpinner: {
        marginLeft: `0.785em`,
        marginRight: `0.785em`
      },
      loadingSpinner: {
        marginTop: `5em`,
        marginLeft: `10em`,
      },
      cameraDeviceIcon: {
        marginLeft: '2.4em',
        marginTop: '-2.45em'
      },
      cameraDeviceIndex: {
        marginLeft: '0.25em',
        marginTop: '-2.65em'
      },
      switchCameraButton: {
        marginLeft: '-2.5em',
        marginTop: '-4.25em'
      },
      scanButton: {
        marginLeft: '-0.7em'
      },
      closGameWarningButton: {

      }
    }
  }
}
