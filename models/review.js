const mongoose  = require('mongoose');
const Schema = mongoose.Schema;
const ReviewSchema = new Schema({
    rating: Number,
    description: String,
    bookId:String,
    user:{
        type: Schema.Types.ObjectId,
        ref:'User'
    }    
})

module.exports = mongoose.model('Review', ReviewSchema);