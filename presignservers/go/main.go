package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"

	"github.com/gin-gonic/gin"
)

var (
	date        string
	regionName  string
	serviceName string
	requestName string
)

var db = make(map[string]string)

func setupRouter() *gin.Engine {
	r := gin.Default()
	// Ping test
	r.GET("/sign_auth", func(c *gin.Context) {
		c.JSON(200, gin.H{"pong": "pong"})
	})

	return r
}

func signature(t, sts string) string {
	h := HMAC(derivedKey(t), []byte(sts))
	return fmt.Sprintf("%x", h)
}

func derivedKey(t string) []byte {
	h := HMAC([]byte("AWS4"+"AWS_SECRET"), []byte(t))
	h = HMAC(h, []byte(regionName))
	h = HMAC(h, []byte(serviceName))
	h = HMAC(h, []byte(requestName))
	return h
}

func HMAC(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func main() {
	r := setupRouter()
	// Listen and Server in 0.0.0.0:8080
	r.Run(":8080")
}
