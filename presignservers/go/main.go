package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

var (
	date        string
	regionName  string
	serviceName string
	requestName string
)

var db = make(map[string]string)

func setupRouter(awsSecret string) *gin.Engine {
	r := gin.Default()
	// Ping test
	r.GET("/sign_auth", func(c *gin.Context) {
		qs := c.Query("to_sign")

		strs := strings.Split(qs, "\n")
		if len(strs) <= 1 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "to_sign is invalid"})
			return
		}
		data := strings.Split(strs[2], "/")
		date, regionName, serviceName, requestName = data[0], data[1], data[2], data[3]

		log.Info().Msgf("date: %s, regionName: %s, serviceName: %s, requestName: %s", date, regionName, serviceName, requestName)

		signedKey := signature(date, qs, awsSecret)

		c.Data(http.StatusOK, "application/octet-stream", []byte(signedKey))
	})

	return r
}

func signature(t, sts string, awsSecretKey string) string {
	h := signHmac(derivedKey(t, awsSecretKey), []byte(sts))
	return fmt.Sprintf("%x", h)
}

func derivedKey(t string, awsSecretKey string) []byte {
	h := signHmac([]byte("AWS4"+awsSecretKey), []byte(t))
	h = signHmac(h, []byte(regionName))
	h = signHmac(h, []byte(serviceName))
	h = signHmac(h, []byte(requestName))
	return h
}

// HMAC
func signHmac(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func main() {
	err := godotenv.Load("../.env")
	awsSecret := os.Getenv("AWS_SECRET")
	if err != nil {
		log.Fatal().Msgf("Error loading .env file", err)
	}
	if awsSecret == "" {
		log.Fatal().Msg("AWS_SECRET is empty")
	}

	r := setupRouter(awsSecret)
	// Listen and Server in 0.0.0.0:8080
	r.Run(":8080")
}
