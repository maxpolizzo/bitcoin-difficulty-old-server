async def m001_initial(db):
    """
    Games table.
    """
    await db.execute(
        f"""
        CREATE TABLE difficulty.games (
            game_id TEXT PRIMARY KEY,
            admin_user_id TEXT NOT NULL,
            free_market_liquidity {db.big_int},
            payment_req TEXT,
            payment_hash TEXT,
            invite_voucher_id TEXT,
            reward_voucher_id TEXT,
            initial_funding {db.big_int},
            initial_player_balance {db.big_int},
            started BOOLEAN DEFAULT false,
            max_players_count INTEGER NOT NULL,
            available_player_names TEXT NOT NULL,
            cumulated_fines {db.big_int},
            player_turn TEXT DEFAULT "0",
            time TIMESTAMP NOT NULL DEFAULT TIMESTAMP NOT NULL DEFAULT """+ db.timestamp_now + """
        );
    """
    )

    """
    Wallets table.
    """
    await db.execute(
        f"""
        CREATE TABLE difficulty.wallets (
            game_id TEXT NOT NULL,
            is_free_market BOOLEAN DEFAULT false,
            player_index TEXT NOT NULL,
            client_id TEXT,
            balance_msat {db.big_int},
            user TEXT NOT NULL,
            id TEXT PRIMARY KEY,
            inkey TEXT NOT NULL,
            adminkey TEXT NOT NULL,
            pay_link_id TEXT,
            pay_link TEXT
        );
    """
    )

    """
    Players table.
    """
    await db.execute(
        f"""
        CREATE TABLE difficulty.players (
            game_id TEXT NOT NULL,
            player_index TEXT NOT NULL,
            player_name TEXT,
            active BOOLEAN DEFAULT true,
            pow_provided BOOLEAN DEFAULT false,
            technology_card_picked BOOLEAN DEFAULT false,
            black_swan_card_picked BOOLEAN DEFAULT false
        );
    """
    )

    """
    Properties table.
    """
    await db.execute(
        f"""
        CREATE TABLE difficulty.properties (
            game_id TEXT NOT NULL,
            property_id TEXT NOT NULL,
            color TEXT NOT NULL,
            player_index TEXT NOT NULL,
            mining_capacity INTEGER,
            mining_income INTEGER
        );
    """
    )

    """
    Cards table.
    """
    await db.execute(
        f"""
        CREATE TABLE difficulty.cards (
            game_id TEXT NOT NULL,
            card_type TEXT NOT NULL,
            ids TEXT NOT NULL,
            card_index INTEGER NOT NULL,
            max_index INTEGER NOT NULL
        );
    """
    )

    """
    Websocket authorization tokens table.
    """
    await db.execute(
        f"""
        CREATE TABLE difficulty.ws_auth_tokens (
            auth_token TEXT PRIMARY KEY
        );
    """
    )
