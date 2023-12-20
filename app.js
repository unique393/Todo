if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const Listing = require("./models/listing.js");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
// const wrapAsync = require(".utils/wrapAsync.js");
const cookieParser = require("cookie-parser");
const flash = require("connect-flash");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const LocalStragy = require("passport-local");
const User = require("./models/user.js");
const { isLoggedIn } = require("./middleware.js");

app.use(cookieParser("secretcode"));

const dbUrl = process.env.ATLASDB_URL;

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", () => {
  console.log("error in mongo session store", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() * 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStragy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

//signup
app.get("/", (req, res) => {
  res.render("users/signup.ejs");
});

app.post("/", async (req, res) => {
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    await User.register(newUser, password);
    res.redirect("/list");
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/");
  }
});

//login
app.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  async (req, res) => {
    res.redirect("/list");
  }
);

//logout
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged out");
    res.redirect("/");
  });
});

//show
app.get("/list", isLoggedIn, async (req, res) => {
  const allListing = await Listing.find({});
  res.render("listings/index.ejs", { allListing });
});

//create
app.get("/list/new", isLoggedIn, (req, res) => {
  res.render("listings/new.ejs");
});

app.post("/list", isLoggedIn, async (req, res) => {
  const newList = new Listing(req.body.list);
  newList.owner = req.user._id;
  await newList.save();
  req.flash("success", "New List Created!");
  res.redirect("/list");
});

//show perticular list
app.get("/list/:id", isLoggedIn, async (req, res) => {
  let { id } = req.params;
  let list = await Listing.findById(id).populate("owner");
  console.log(list);
  res.render("listings/show.ejs", { list });
});

//edit
app.get("/list/:id/edit", isLoggedIn, async (req, res) => {
  let { id } = req.params;
  let list = await Listing.findById(id);
  res.render("listings/edit.ejs", { list });
});

app.put("/list/:id", isLoggedIn, async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndUpdate(id, { ...req.body.list });
  res.redirect(`/list/${id}`);
});

//delete
app.delete("/list/:id", isLoggedIn, async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  res.redirect("/list");
});

app.listen(8080, () => {
  console.log("server is listen port 8080");
});

app.use((err, req, res, next) => {
  res.send("something went wrong");
});
