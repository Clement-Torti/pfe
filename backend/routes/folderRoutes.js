const express = require('express')
const router = express.Router()
const Logger = require('../lib/logger')

const Folder = require('../database/models/folder')
const File = require('../database/models/file')

router.get('/folders', (req, res) => {
  Folder.find({})
    .then(folders => res.send(folders))
    .catch((error) => Logger.http(error))
})

router.post('/folders', (req, res) => {
  (new Folder({ title: req.body.title }))
    .save()
    .then((folder) => res.send(folder))
    .catch((error) => Logger.http(error))
})

router.get('/folders/:folderId', (req, res) => {
  Folder.findOne({ _id: req.params.folderId })
    .then((folder) => { res.send(folder) })
    .catch((error) => Logger.http(error))
})

router.delete('/folders/clean', (req, res) => {
  Folder.find({})
    .then(folders => {
      folders.forEach(folder => {
        File.deleteMany({ _folderId: folder._id })
          .then(() => Logger.http(`All files of "${folder.title}" deleted`))
          .catch((error) => Logger.http(error))

        Folder.findOneAndDelete(folder._id)
          .then(() => Logger.http(`Folder "${folder.title}" deleted`))
          .catch((error) => Logger.http(error))
      })
    })
    .catch((error) => Logger.http(error))

  res.send('Folders cleaned')
})

router.delete('/folders/:folderId', (req, res) => {
  const deleteFiles = (folder) => {
    File.deleteMany({ _folderId: folder._id })
      .then(() => folder)
      .catch((error) => Logger.http(error))
  }
  Folder.findByIdAndDelete(req.params.folderId)
    .then((folder) => res.send(deleteFiles(folder)))
    .catch((error) => Logger.http(error))
})

module.exports = router
