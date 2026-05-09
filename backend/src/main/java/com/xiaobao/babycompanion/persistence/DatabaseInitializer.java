package com.xiaobao.babycompanion.persistence;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import javax.sql.DataSource;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseInitializer implements ApplicationRunner {

    public static final String DEFAULT_FAMILY_ID = "family-default";
    public static final String DEFAULT_FAMILY_NAME = "小宝家";

    private final DataSource dataSource;

    public DatabaseInitializer(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode=WAL");
            statement.execute("PRAGMA synchronous=NORMAL");
            statement.execute("PRAGMA busy_timeout=10000");
            statement.execute("PRAGMA foreign_keys=ON");
            createRecordTable(connection, statement, "baby_profile");
            createRecordTable(connection, statement, "chat_message");
            createRecordTable(connection, statement, "growth_event");
            createRecordTable(connection, statement, "care_log");
            createRecordTable(connection, statement, "reminder");
            createRecordTable(connection, statement, "memory_item");
            createRecordTable(connection, statement, "pending_effect");
            createRecordTable(connection, statement, "album_item");
            createRecordTable(connection, statement, "conversation_summary");
            createAuthTables(connection, statement);
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS attachment (
                      id TEXT PRIMARY KEY,
                      name TEXT,
                      kind TEXT,
                      mime_type TEXT,
                      file_path TEXT NOT NULL,
                      public_url TEXT,
                      thumbnail_path TEXT,
                      thumbnail_url TEXT,
                      owner_type TEXT,
                      owner_id TEXT,
                      owner_user_id TEXT,
                      family_id TEXT,
                      created_by_user_id TEXT,
                      created_at TEXT,
                      payload_json TEXT
                    )
                    """);
            addColumnIfMissing(connection, statement, "attachment", "owner_user_id", "TEXT");
            addColumnIfMissing(connection, statement, "attachment", "family_id", "TEXT");
            addColumnIfMissing(connection, statement, "attachment", "created_by_user_id", "TEXT");
            addColumnIfMissing(connection, statement, "attachment", "thumbnail_path", "TEXT");
            addColumnIfMissing(connection, statement, "attachment", "thumbnail_url", "TEXT");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_attachment_owner ON attachment(owner_type, owner_id)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_attachment_owner_user ON attachment(owner_user_id)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_attachment_family ON attachment(family_id)");
            migrateDefaultFamily(statement);
        }
    }

    private void createRecordTable(Connection connection, Statement statement, String tableName) throws Exception {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS %s (
                  id TEXT PRIMARY KEY,
                  payload_json TEXT NOT NULL,
                  role TEXT,
                  status TEXT,
                  sort_key TEXT,
                  owner_user_id TEXT,
                  family_id TEXT,
                  created_by_user_id TEXT,
                  created_at TEXT,
                  updated_at TEXT
                )
                """.formatted(tableName));
        addColumnIfMissing(connection, statement, tableName, "owner_user_id", "TEXT");
        addColumnIfMissing(connection, statement, tableName, "family_id", "TEXT");
        addColumnIfMissing(connection, statement, tableName, "created_by_user_id", "TEXT");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_%s_sort ON %s(sort_key)".formatted(tableName, tableName));
        statement.execute("CREATE INDEX IF NOT EXISTS idx_%s_status ON %s(status)".formatted(tableName, tableName));
        statement.execute("CREATE INDEX IF NOT EXISTS idx_%s_owner_user ON %s(owner_user_id)".formatted(tableName, tableName));
        statement.execute("CREATE INDEX IF NOT EXISTS idx_%s_family ON %s(family_id)".formatted(tableName, tableName));
    }

    private void createAuthTables(Connection connection, Statement statement) throws Exception {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_user (
                  id TEXT PRIMARY KEY,
                  phone TEXT NOT NULL UNIQUE,
                  invite_code_hash TEXT,
                  created_at TEXT,
                  last_login_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_user_phone ON auth_user(phone)");
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_family (
                  id TEXT PRIMARY KEY,
                  name TEXT,
                  default_invite_code_id TEXT,
                  created_at TEXT
                )
                """);
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_family_member (
                  id TEXT PRIMARY KEY,
                  family_id TEXT NOT NULL,
                  user_id TEXT NOT NULL,
                  role_name TEXT,
                  is_caregiver TEXT,
                  joined_invite_code_id TEXT,
                  joined_at TEXT,
                  last_seen_at TEXT
                )
                """);
        statement.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_family_member_user ON auth_family_member(user_id)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_family_member_family ON auth_family_member(family_id)");
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_invite_code (
                  id TEXT PRIMARY KEY,
                  code_hash TEXT NOT NULL UNIQUE,
                  label TEXT,
                  family_id TEXT,
                  assigned_user_id TEXT,
                  active TEXT,
                  created_at TEXT,
                  used_at TEXT
                )
                """);
        addColumnIfMissing(connection, statement, "auth_invite_code", "family_id", "TEXT");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_invite_code_hash ON auth_invite_code(code_hash)");
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_invite_code_family ON auth_invite_code(family_id)");
        statement.execute("""
                CREATE TABLE IF NOT EXISTS auth_session (
                  id TEXT PRIMARY KEY,
                  user_id TEXT NOT NULL,
                  created_at TEXT,
                  expires_at TEXT,
                  revoked_at TEXT
                )
                """);
        statement.execute("CREATE INDEX IF NOT EXISTS idx_auth_session_user ON auth_session(user_id)");
    }

    private void migrateDefaultFamily(Statement statement) throws Exception {
        boolean needsDefaultFamily =
                hasRows(statement, """
                        SELECT 1 FROM auth_invite_code
                        WHERE (family_id IS NULL OR family_id = '')
                          AND (
                            (assigned_user_id IS NOT NULL AND assigned_user_id != '')
                            OR (used_at IS NOT NULL AND used_at != '')
                          )
                        LIMIT 1
                        """)
                        || hasRows(statement, """
                        SELECT 1 FROM auth_user u
                        WHERE NOT EXISTS (
                          SELECT 1 FROM auth_family_member m WHERE m.user_id = u.id
                        )
                        LIMIT 1
                        """);
        for (String table : recordTables()) {
            needsDefaultFamily = needsDefaultFamily || hasRows(statement, """
                    SELECT 1 FROM %s
                    WHERE family_id IS NULL OR family_id = ''
                    LIMIT 1
                    """.formatted(table));
        }
        needsDefaultFamily = needsDefaultFamily || hasRows(statement, """
                SELECT 1 FROM attachment
                WHERE family_id IS NULL OR family_id = ''
                LIMIT 1
                """);

        if (needsDefaultFamily) {
            statement.execute("""
                    INSERT OR IGNORE INTO auth_family (id, name, created_at)
                    VALUES ('%s', '%s', datetime('now'))
                    """.formatted(DEFAULT_FAMILY_ID, DEFAULT_FAMILY_NAME));
            statement.execute("""
                    UPDATE auth_invite_code
                    SET family_id = '%s'
                    WHERE (family_id IS NULL OR family_id = '')
                      AND (
                        (assigned_user_id IS NOT NULL AND assigned_user_id != '')
                        OR (used_at IS NOT NULL AND used_at != '')
                      )
                    """.formatted(DEFAULT_FAMILY_ID));
            statement.execute("""
                    UPDATE auth_family
                    SET default_invite_code_id = (
                      SELECT id FROM auth_invite_code
                      WHERE family_id = '%s'
                      ORDER BY created_at, id
                      LIMIT 1
                    )
                    WHERE id = '%s'
                      AND (default_invite_code_id IS NULL OR default_invite_code_id = '')
                    """.formatted(DEFAULT_FAMILY_ID, DEFAULT_FAMILY_ID));
            statement.execute("""
                    INSERT OR IGNORE INTO auth_family_member (
                      id, family_id, user_id, role_name, is_caregiver,
                      joined_invite_code_id, joined_at, last_seen_at
                    )
                    SELECT
                      'member-' || u.id,
                      '%s',
                      u.id,
                      '家庭照护人',
                      'true',
                      (
                        SELECT i.id FROM auth_invite_code i
                        WHERE i.code_hash = u.invite_code_hash
                        LIMIT 1
                      ),
                      COALESCE(u.created_at, datetime('now')),
                      u.last_login_at
                    FROM auth_user u
                    WHERE NOT EXISTS (
                      SELECT 1 FROM auth_family_member m WHERE m.user_id = u.id
                    )
                    """.formatted(DEFAULT_FAMILY_ID));
            for (String table : recordTables()) {
                statement.execute("""
                        UPDATE %s
                        SET family_id = '%s'
                        WHERE family_id IS NULL OR family_id = ''
                        """.formatted(table, DEFAULT_FAMILY_ID));
                statement.execute("""
                        UPDATE %s
                        SET created_by_user_id = CASE
                          WHEN owner_user_id IS NOT NULL AND owner_user_id != '' THEN owner_user_id
                          ELSE created_by_user_id
                        END
                        WHERE created_by_user_id IS NULL OR created_by_user_id = ''
                        """.formatted(table));
            }
            statement.execute("""
                    UPDATE attachment
                    SET family_id = '%s'
                    WHERE family_id IS NULL OR family_id = ''
                    """.formatted(DEFAULT_FAMILY_ID));
            statement.execute("""
                    UPDATE attachment
                    SET created_by_user_id = CASE
                      WHEN owner_user_id IS NOT NULL AND owner_user_id != '' THEN owner_user_id
                      ELSE created_by_user_id
                    END
                    WHERE created_by_user_id IS NULL OR created_by_user_id = ''
                    """);
        }
    }

    private void addColumnIfMissing(Connection connection, Statement statement, String tableName, String columnName, String type) throws Exception {
        try (ResultSet resultSet = connection.createStatement().executeQuery("PRAGMA table_info(" + tableName + ")")) {
            while (resultSet.next()) {
                if (columnName.equalsIgnoreCase(resultSet.getString("name"))) {
                    return;
                }
            }
        }
        statement.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + type);
    }

    private String[] recordTables() {
        return new String[]{
                "baby_profile",
                "chat_message",
                "growth_event",
                "care_log",
                "reminder",
                "memory_item",
                "pending_effect",
                "album_item",
                "conversation_summary"
        };
    }

    private boolean hasRows(Statement statement, String query) throws Exception {
        try (ResultSet resultSet = statement.executeQuery(query)) {
            return resultSet.next();
        }
    }
}
