const mongoose  = require('mongoose');
const Schema = mongoose.Schema;

const FavouriteSchema = new Schema({
    bookId:{
        type:String,
        unique:true
    } ,
    user:{
        type: Schema.Types.ObjectId,
        ref:'User'
    },
    title: String,
    imageUrl: String,
    authorId: String,
    authorName: String,
})

module.exports = mongoose.model('Favourite', FavouriteSchema);

