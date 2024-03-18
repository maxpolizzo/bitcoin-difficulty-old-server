async def m001_initial(db):
    """
    Games table.
    """
    await db.execute(
       f"""
       CREATE TABLE monopoly.games (
           game_id TEXT PRIMARY KEY,
           admin_user_id TEXT NOT NULL,
           free_market_wallet_id TEXT NOT NULL,
           free_market_wallet_inkey TEXT NOT NULL,
           free_market_wallet_adminkey TEXT NOT NULL,
           market_liquidity {db.big_int},
           pay_link_id TEXT,
           pay_link TEXT,
           invite_voucher_id TEXT,
           reward_voucher_id TEXT,
           initial_funding {db.big_int},
           initial_player_balance {db.big_int},
           started BOOLEAN DEFAULT false,
           max_players_count INTEGER NOT NULL,
           available_player_names TEXT NOT NULL,
           payment_req TEXT,
           payment_hash TEXT,
           cumulated_fines {db.big_int},
           player_turn INTEGER,
           time TIMESTAMP NOT NULL DEFAULT TIMESTAMP NOT NULL DEFAULT """+ db.timestamp_now + """
       );
    """
    )

    """
    Players table.
    """
    await db.execute(
      f"""
      CREATE TABLE monopoly.players (
          player_index INTEGER NOT NULL,
          player_user_id TEXT NOT NULL,
          player_wallet_id TEXT NOT NULL,
          player_wallet_name TEXT NOT NULL,
          player_wallet_inkey TEXT NOT NULL,
          player_balance {db.big_int},
          player_pay_link_id TEXT,
          player_pay_link TEXT,
          game_id TEXT NOT NULL,
          first_start_claim_this_turn BOOLEAN DEFAULT true,
          first_lightning_card_this_turn BOOLEAN DEFAULT true,
          first_protocol_card_this_turn BOOLEAN DEFAULT true,
          time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    """
    )

    """
    Properties table.
    """
    await db.execute(
      f"""
      CREATE TABLE monopoly.properties (
          property_id INTEGER NOT NULL,
          property_color TEXT NOT NULL,
          property_owner_id TEXT,
          property_mining_capacity INTEGER,
          property_mining_income INTEGER,
          game_id TEXT NOT NULL,
          time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    """
    )

    """
    Lightning and protocol cards table.
    """
    await db.execute(
      f"""
      CREATE TABLE monopoly.cards (
          game_id TEXT NOT NULL,
          card_type TEXT NOT NULL,
          next_index INTEGER NOT NULL,
          player_index INTEGER NOT NULL,
          time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    """
    )

    """
    Payments table.
    """
    await db.execute(
      f"""
      CREATE TABLE monopoly.payments (
          game_id TEXT NOT NULL,
          player_wallet_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          date_time TEXT NOT NULL,
          is_in BOOLEAN NOT NULL,
          is_out BOOLEAN NOT NULL,
          memo TEXT NOT NULL,
          payment_hash TEXT NOT NULL,
          bolt11 TEXT NOT NULL
      );
    """
    )
