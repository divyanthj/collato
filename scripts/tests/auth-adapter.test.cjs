const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { ObjectId } = require("mongodb");

const adapterPath = path.resolve(__dirname, "../../lib/auth-adapter.js");

async function createAdapterFixture(initialUser) {
    let storedUser = initialUser ? { ...initialUser } : null;
    const writes = [];
    const collection = {
        async updateOne(filter, update) {
            writes.push({ filter, update });
            if (storedUser && storedUser._id.equals(filter._id)) {
                storedUser = { ...storedUser, ...update.$set };
            }
        },
        async findOne(filter) {
            return storedUser && storedUser._id.equals(filter._id) ? { ...storedUser } : null;
        }
    };
    const database = {
        collection(name) {
            assert.equal(name, "auth_users");
            return collection;
        }
    };
    const context = vm.createContext({ Date });
    const adapterModule = new vm.SourceTextModule(await readFile(adapterPath, "utf8"), {
        context,
        identifier: adapterPath
    });
    await adapterModule.link((specifier) => {
        if (specifier === "mongodb") {
            return new vm.SyntheticModule(["ObjectId"], function () {
                this.setExport("ObjectId", ObjectId);
            }, { context });
        }
        if (specifier === "@/lib/mongodb") {
            return new vm.SyntheticModule(["getDatabase"], function () {
                this.setExport("getDatabase", async () => database);
            }, { context });
        }
        throw new Error(`Unexpected adapter import: ${specifier}`);
    });
    await adapterModule.evaluate();
    return {
        adapter: adapterModule.namespace.MongoWorkspaceAuthAdapter(),
        writes,
        getStoredUser: () => storedUser
    };
}

function existingUser() {
    return {
        _id: new ObjectId(),
        name: "Independent Customer",
        email: "customer@example.test",
        emailVerified: null,
        image: "https://example.test/avatar.png"
    };
}

test("email verification preserves the existing email, name, and image", async () => {
    const user = existingUser();
    const fixture = await createAdapterFixture(user);
    const verifiedAt = new Date("2026-10-05T08:00:00Z");
    const updated = await fixture.adapter.updateUser({ id: String(user._id), emailVerified: verifiedAt });

    assert.equal(updated.email, user.email);
    assert.equal(updated.name, user.name);
    assert.equal(updated.image, user.image);
    assert.equal(updated.emailVerified, verifiedAt);
    assert.deepEqual(Object.keys(fixture.writes[0].update.$set), ["emailVerified"]);
    assert.equal(fixture.getStoredUser().email, user.email);
});

test("supplied profile fields update and email is normalized", async () => {
    const user = existingUser();
    const fixture = await createAdapterFixture(user);
    const updated = await fixture.adapter.updateUser({
        id: String(user._id),
        name: "New Customer Name",
        email: "  NEW.Customer@Example.test  ",
        image: "https://example.test/new-avatar.png"
    });

    assert.equal(updated.name, "New Customer Name");
    assert.equal(updated.email, "new.customer@example.test");
    assert.equal(updated.image, "https://example.test/new-avatar.png");
    assert.equal(updated.emailVerified, null);
    assert.deepEqual(Object.keys(fixture.writes[0].update.$set), ["name", "email", "image"]);
});

test("explicit null clears nullable fields without erasing email", async () => {
    const user = { ...existingUser(), emailVerified: new Date("2026-10-01T08:00:00Z") };
    const fixture = await createAdapterFixture(user);
    const updated = await fixture.adapter.updateUser({
        id: String(user._id),
        name: null,
        image: null,
        emailVerified: null
    });

    assert.equal(updated.name, null);
    assert.equal(updated.image, null);
    assert.equal(updated.emailVerified, null);
    assert.equal(updated.email, user.email);
    assert.deepEqual(Object.keys(fixture.writes[0].update.$set), ["name", "emailVerified", "image"]);
});

test("undefined fields and id-only updates preserve the stored identity without writing", async () => {
    const user = { ...existingUser(), emailVerified: new Date("2026-10-01T08:00:00Z") };
    const fixture = await createAdapterFixture(user);
    const updated = await fixture.adapter.updateUser({
        id: String(user._id),
        name: undefined,
        email: undefined,
        emailVerified: undefined,
        image: undefined
    });
    const idOnly = await fixture.adapter.updateUser({ id: String(user._id) });

    for (const result of [updated, idOnly]) {
        assert.equal(result.email, user.email);
        assert.equal(result.name, user.name);
        assert.equal(result.image, user.image);
        assert.equal(result.emailVerified, user.emailVerified);
    }
    assert.equal(fixture.writes.length, 0);
});

test("invalid and missing user IDs keep the adapter error behavior", async () => {
    const fixture = await createAdapterFixture(null);
    await assert.rejects(fixture.adapter.updateUser({ id: "invalid", emailVerified: new Date() }), {
        message: "Invalid user id"
    });
    assert.equal(fixture.writes.length, 0);
    await assert.rejects(fixture.adapter.updateUser({ id: String(new ObjectId()) }), {
        message: "User not found"
    });
    assert.equal(fixture.writes.length, 0);
});
